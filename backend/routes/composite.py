# backend/routes/composite.py
from datetime import datetime, timezone
from backend.firebase import db, eventsCo, formsCo, recurCo
from backend.logger import getLogger

logger = getLogger(__name__)

def upsertComposite(payload: dict, uID: str) -> dict:
	"""
	Atomic upsert of {form,event,recur}.
	payload keys follow emptyForm / emptyEvent / emptyRRule spec.
	Returns IDs dict.
	"""
	formData  = payload.get("form",  {})
	eventData = payload.get("event", {})
	recurData = payload.get("recur", {})

	formID = formData.pop("_id", None)
	formUpdate = formData.pop("update", None)
	eventID = eventData.pop("_id", None)
	eventUpdate = eventData.pop("update", None)
	recurID = recurData.pop("_id", None)
	recurUpdate = recurData.pop("update", None)

	batch = db.batch()

	if formID and formUpdate:
		formRef = formsCo.document(formID)
		batch.set(formRef, {**formData, "ownerID": uID}, merge=True)
		formID = formRef.id
	elif formUpdate:
		formRef = formsCo.document()
		formID  = formRef.id
		batch.set(formRef, {**formData, "ownerID": uID})

	if eventID:
		eventRef = eventsCo.document(eventID)
		eventID  = eventRef.id
	else:
		eventRef = eventsCo.document()
		eventID  = eventRef.id

	eventToStore = {
		**eventData,
		"ownerID": uID,
	}
	batch.set(eventRef, eventToStore, merge=True)

	batch.commit()
	return { "formID": formID, "eventID": eventID, "recurrenceID": None }
