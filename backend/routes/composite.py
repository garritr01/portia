# backend/routes/composite.py
import json
from datetime import datetime, timezone
from backend.firebase import db, eventsCo, formsCo, schedulesCo
from backend.logger import getLogger

logger = getLogger(__name__)

def upsertComposite(payload: dict, uID: str) -> dict:
	"""
	Atomic upsert of {form,event,schedules}.
	payload keys follow emptyForm / emptyEvent / emptySchedules spec.
	Returns IDs dict.
	"""
	formData  = payload.get("form",  {})
	eventData = payload.get("event", {})
	schedData = payload.get("schedules", [])
	dirty = payload.get("dirty", None) # Change flag for each object

	# Store objects to be saved for inspection
	objDir = '/home/garritr01/Documents/portiaApp/backend/logs/objects/'
	with open(f"{objDir}form.json", "w") as file:
		json.dump(formData, file, indent=2)
	with open(f"{objDir}event.json", "w") as file:
		json.dump(eventData, file, indent=2)
	with open(f"{objDir}schedules.json", "w") as file:
		json.dump(schedData, file, indent=2)

	logger.debug(json.dumps(dirty, indent=2))

	formID = formData.pop("_id", None)
	eventID = eventData.pop("_id", None)
	schedIDs = []

	batch = db.batch()

	# Need to get formID for later, only update if dirty (probably could be more concise later, should always be dirty if new)
	if formID: # If formID present, update
		formRef = formsCo.document(formID)
	else: # Else, create
		formRef = formsCo.document()
		formID  = formRef.id
	if dirty['form']: # Save form if dirty
		batch.set(formRef, {**formData, "ownerID": uID}, merge=True)

	# Iterate through schedules and save if dirty
	for i, sched in enumerate(schedData):
		schedID = sched.pop("_id", None)
		key = schedID if schedID else f'new_{i}' # use 'new_{index}' dirty key if is is none
		
		if not dirty['schedules'][key]:
			continue

		sched["formID"] = formID # Add formID for reference
		if schedID: # If schedID present, update
			schedRef = schedulesCo.document(schedID)
			batch.set(schedRef, {**sched, "ownerID": uID}, merge=True)
		else: # Else, create
			schedRef = schedulesCo.document()
			schedID  = schedRef.id
			batch.set(schedRef, {**sched, "ownerID": uID})
		
		schedIDs.append(schedID) # Add updated ids to return to frontend

	# Remove deleted schedules
	for k, isDirty in dirty['schedules'].items():
		if not isDirty or k.startswith('new_'):
			continue
		if k not in schedIDs:
			ref = schedulesCo.document(k).delete()

	# Save event if dirty
	if dirty['event']:
		eventData["formID"] = formID # Store formID with event
		if eventID : # If eventID present, update
			eventRef = eventsCo.document(eventID)
			batch.set(eventRef, { **eventData, "ownerID": uID }, merge=True)
		else: # Else, create
			eventRef = eventsCo.document()
			eventID  = eventRef.id
			batch.set(eventRef, {**eventData, "ownerID": uID})

	batch.commit()

	# Read the stored objects and return (respects security rule changes)
	form = formsCo.document(formID).get()
	updatedForm = { **form.to_dict(), "_id": form.id }

	updatedSchedules = []
	for sID in schedIDs:
		sched = schedulesCo.document(sID).get()
		updatedSchedules.append({ **sched.to_dict(), "_id": sched.id })

	if dirty["event"]:
		event = eventsCo.document(eventID).get()
		updatedEvent = { **event.to_dict(), "_id": event.id }
	else:
		updatedEvent = { "_id": None }

	return { "form": updatedForm, "event": updatedEvent, "schedules": updatedSchedules }
