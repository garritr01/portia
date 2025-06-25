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
	#with open(f"{objDir}form.json", "w") as file:
	#	json.dump(formData, file, indent=2)
	#with open(f"{objDir}event.json", "w") as file:
	#	json.dump(eventData, file, indent=2)
	with open(f"{objDir}schedules.json", "w") as file:
		json.dump(schedData, file, indent=2)

	logger.debug(json.dumps(dirty, indent=2))

	formID = formData.pop("_id", None)
	eventID = eventData.pop("_id", None)
	schedIDs = []

	batch = db.batch()

	if formID: # If formID present, update
		formRef = formsCo.document(formID)
	else: # Else, create
		formRef = formsCo.document()
		formID  = formRef.id
	if dirty['form']: # Save form if dirty
		batch.set(formRef, {**formData, "ownerID": uID}, merge=True)
	eventData["formID"] = formID # Store formID with event

	# Iterate through schedules and save if dirty
	for s in range(len(schedData)):
		oneSched = schedData[s]
		oneSched["formID"] = formID # Add formID to reference when resolving events
		schedID = oneSched.pop("_id", None)
		if schedID and dirty['schedules'][s]: # If schedID present, update
			schedRef = schedulesCo.document(schedID)
			batch.set(schedRef, {**oneSched, "ownerID": uID}, merge=True)
		elif dirty['schedules'][s]: # Else, create
			schedRef = schedulesCo.document()
			schedID  = schedRef.id
			batch.set(schedRef, {**oneSched, "ownerID": uID})
		
		schedIDs.append(schedID)

	# Save event if dirty
	if eventID and dirty['event']: # If eventID present, update
		eventRef = eventsCo.document(eventID)
		batch.set(eventRef, { **eventData, "ownerID": uID }, merge=True)
	elif dirty['event']: # Else, create
		eventRef = eventsCo.document()
		eventID  = eventRef.id
		batch.set(eventRef, {**eventData, "ownerID": uID})

	batch.commit()
	return { "formID": formID, "eventID": eventID, "scheduleIDs": schedIDs }
