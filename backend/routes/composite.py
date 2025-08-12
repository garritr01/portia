# backend/routes/composite.py
from flask import Blueprint, jsonify, request
import os
import json
from backend.firebase import db, eventsCo, formsCo, schedulesCo
from backend.auth import handleFirebaseAuth
from backend.logger import logRequests, getLogger
from backend.helpers import _convertStamps2ISOString, _convertStamps2TimeStamp

logger = getLogger(__name__)
compositeBP = Blueprint("composite", __name__, url_prefix="/composite")

@compositeBP.route("", methods=["POST", "PUT"])
@logRequests
@handleFirebaseAuth
def upsertComposite(uID) -> dict:
	"""
	Atomic upsert of {form,event,schedules}.
	payload keys follow emptyForm / emptyEvent / emptySchedules spec.
	Returns IDs dict.
	"""
	payload = request.get_json() or {}

	# Save payload for inspection
	try:
		objDir = '/home/garritr01/Documents/portiaApp/backend/logs/objects/'
		os.makedirs(objDir, exist_ok=True)
		with open(f"{objDir}payload.json", "w") as f:
			json.dump(payload, f, indent=2)
	except Exception as e:
		logger.debug(f"Skip payload dump: {e}")

	# Grab individual objects from payload
	form  = payload.get("form",  None)
	event = payload.get("event", None)
	scheds = payload.get("schedules", None)
	dirty = payload.get("dirty", None)
	toDelete = payload.get("toDelete", None)

	# region GUARD
	validComposite = True
	invalidCompositeInfo = "Canceling upsertComposite"

	# type check
	if not all(isinstance(obj, dict) for obj in (form, event, dirty, toDelete)):
		objs = {
			"form": form, "event": event, "schedules": scheds, "dirty": dirty, "toDelete": toDelete
		}
		bad = [f"{k}: {type(v).__name__}" for k, v in objs.items() if not isinstance(v, dict)]
		invalidCompositeInfo += "\n due to invalid types: " + ", ".join(bad)
		validComposite = False

	# required keys + value types (always check; even if {} we want errors)
	for name, obj in (("toDelete", toDelete or {}), ("dirty", dirty or {})):
		missing = [k for k in ("form", "event", "schedules") if k not in obj]
		if missing:
			invalidCompositeInfo += f"\n due to missing {name} indicators: [{', '.join(missing)}]"
			validComposite = False
		else:
			# form/event flags must be bool
			for subName in ("form", "event"):
				val = obj.get(subName)
				if not isinstance(val, bool):
					invalidCompositeInfo += f"\n due to non-bool {name}.{subName} indicator type: {type(val).__name__}"
					validComposite = False
			# schedules map must be dict[str,bool]
			smap = obj.get("schedules")
			if not isinstance(smap, dict):
				invalidCompositeInfo += f"\n due to non-dict {name}['schedules'] indicator type: {type(smap).__name__}"
				validComposite = False
			else:
				for sID, flag in smap.items():
					if not isinstance(flag, bool):
						invalidCompositeInfo += f"\n due to non-bool {name}['schedules']['{sID}'] indicator type: {type(flag).__name__}"
						validComposite = False

	# key alignment between scheds and flag maps (only if all dicts)
	if isinstance(scheds, dict) and isinstance((dirty or {}).get("schedules"), dict) and isinstance((toDelete or {}).get("schedules"), dict):
		schedIDs       = sorted(scheds.keys())
		dirtySchedIDs  = sorted((dirty or {})["schedules"].keys())
		deleteSchedIDs = sorted((toDelete or {})["schedules"].keys())
		for nm, ids in (("dirty", dirtySchedIDs), ("toDelete", deleteSchedIDs)):
			if schedIDs != ids:
				invalidCompositeInfo += f"\n due to mismatched scheduleIDs between {nm}['schedules'] ({', '.join(ids)}) and schedules ({', '.join(schedIDs)})"
				validComposite = False

	if not validComposite:
		logger.warning(invalidCompositeInfo)
		return jsonify({"form": {}, "event": {}, "schedules": []}), 400
	# endregion

	batch = db.batch()

	# region EVENT SAVE/DELETE
	eventID = event.pop("_id", None)
	if toDelete['event']:
		if eventID:
			batch.delete(eventsCo.document(eventID))
	elif dirty['event']:
		if eventID : # If eventID present, update
			eventRef = eventsCo.document(eventID)
			logger.info(f"Updating event: {event.get('path')} ({eventID})")
		else: # Else, create
			eventRef = eventsCo.document()
			eventID  = eventRef.id
			logger.info(f"Creating event: {event.get('path')} ({eventID})")
		
		batch.set(eventRef, { **_convertStamps2TimeStamp(event), "ownerID": uID }, merge=True)
	# endregion

	# region FORM SAVE/DELETE
	formID = form.pop("_id", None)
	if toDelete['form']:
		if formID:
			batch.delete(formsCo.document(formID))
	elif dirty['form']: # Save form if dirty
		if formID: # If formID present, update
			formRef = formsCo.document(formID)
			logger.info(f"Updating form: {form.get('path')} ({formID})")
		else: # Else, create
			formRef = formsCo.document()
			formID  = formRef.id
			logger.info(f"Creating form: {form.get('path')} ({formID})")

		batch.set(formRef, {**form, "ownerID": uID}, merge=True)
	# endregion

	# region SCHEDULES SAVE/DELETE
	updatedSchedIDs, deletedSchedIDs = [], []
	for key, sched in scheds.items():

		if toDelete['schedules'][key]:
			if key and not key.startswith('new_'):
				batch.delete(schedulesCo.document(key))
				deletedSchedIDs.append(key)
		elif dirty['schedules'][key]:
			schedID = sched.pop('_id', None)
			if schedID: # If schedID present, update
				schedRef = schedulesCo.document(schedID)
				logger.info(f"Updating schedule: {sched.get('path')} ({schedID})")
			else: # Else, create
				schedRef = schedulesCo.document()
				schedID  = schedRef.id
				logger.info(f"Creating schedule: {sched.get('path')} ({schedID})")
		
			batch.set(schedRef, {**_convertStamps2TimeStamp(sched), "ownerID": uID}, merge=True)
			updatedSchedIDs.append(schedID) # Record updated schedule IDs for read and return
	# endregion

	batch.commit()

	# region READ UPDATED OBJECTS AND CONFIRM DELETIONS
	deletions = {
		"event": None,
		"form": None,
		"schedules": deletedSchedIDs,
	}

	updatedEvent = { '_id': None }
	if toDelete["event"]:
		deletions["event"] = eventID
	elif dirty["event"]:
		eventDoc = eventsCo.document(eventID).get()
		updatedEvent = { **_convertStamps2ISOString(eventDoc.to_dict()), "_id": eventDoc.id }

	updatedForm = { '_id': None }
	if toDelete["form"]:
		deletions["form"] = formID
	elif dirty["form"]:
		formDoc = formsCo.document(formID).get()
		updatedForm = { **_convertStamps2ISOString(formDoc.to_dict()), "_id": formDoc.id }

	updatedSchedules = []
	for sID in updatedSchedIDs:
		schedDoc = schedulesCo.document(sID).get()
		updatedSchedules.append({ **schedDoc.to_dict(), "_id": schedDoc.id })

	# endregion

	return jsonify({ "form": updatedForm, "event": _convertStamps2ISOString(updatedEvent), "schedules": _convertStamps2ISOString(updatedSchedules), "deletions": deletions }), 200
