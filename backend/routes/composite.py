# backend/routes/composite.py
import json
from datetime import datetime, timezone
from backend.firebase import db, eventsCo, formsCo, recurCo
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
	schedData = payload.get("schedules", {})
	dirty = payload.get("dirty", False)

	logger.debug(json.dumps(dirty, indent=2))

	formID = formData.pop("_id", None)
	eventID = eventData.pop("_id", None)
	schedIDs = []

	batch = db.batch()

	for s in range(len(schedData)):
		schedID = schedData[s].pop("_id", None)
		if schedID and dirty[s]['schedules']:
			schedRef = recurCo.document(schedID)
			batch.set(schedRef, {**schedData[s], "ownerID": uID}, merge=True)
		elif dirty[s]['schedules']:
			schedRef = recurCo.document()
			schedID  = schedRef.id
			batch.set(schedRef, {**schedData[s], "ownerID": uID})
		
		schedIDs.append(schedID)

	if formID and dirty['form']:
		formRef = formsCo.document(formID)
		batch.set(formRef, {**formData, "ownerID": uID}, merge=True)
	elif dirty['form']:
		formRef = formsCo.document()
		formID  = formRef.id
		batch.set(formRef, {**formData, "ownerID": uID})

	if eventID and dirty['event']:
		eventRef = eventsCo.document(eventID)
		batch.set(eventRef, { **eventData, "ownerID": uID }, merge=True)
	elif dirty['event']:
		eventRef = eventsCo.document()
		eventID  = eventRef.id
		batch.set(eventRef, {**eventData, "ownerID": uID})

	batch.commit()
	return { "formID": formID, "eventID": eventID, "scheduleIDs": schedIDs }
