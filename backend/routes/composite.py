# backend/routes/composite.py
from flask import Blueprint, jsonify, request
import os
import json
from backend.firebase import db, eventsCo, formsCo, schedulesCo, completionsCo
from backend.auth import handleFirebaseAuth
from backend.logger import logRequests, getLogger
from backend.helpers import _objsToIso, _objsToDt

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
	form  = payload.get("form",  {})
	event = payload.get("event", {})
	scheds = payload.get("schedules", {})
	comp = payload.get("completion", {})
	dirty = payload.get("dirty", {})
	toDelete = payload.get("toDelete", {})

	# region GUARD
	validComposite = True
	invalidCompositeInfo = "Canceling upsertComposite"

	# top level type check
	if not all(isinstance(obj, dict) for obj in (form, event, scheds, comp, dirty, toDelete)):
		objs = {
			"form": form, "event": event, 
			"schedules": scheds, "completion": comp, 
			"dirty": dirty, "toDelete": toDelete
		}
		bad = [f"{k}: {type(v).__name__}" for k, v in objs.items() if not isinstance(v, dict)]
		invalidCompositeInfo += "\n due to invalid types: " + ", ".join(bad)
		validComposite = False

	# required keys + value types (always check; even if {} we want errors)
	for name, obj in (("toDelete", toDelete), ("dirty", dirty)):
		missing = [k for k in ("form", "event", "completion", "schedules") if k not in obj]
		if missing:
			invalidCompositeInfo += f"\n due to missing {name} indicators: [{', '.join(missing)}]"
			validComposite = False
		else:
			# form/event flags must be bool
			for objName in ("form", "event", "completion"):
				val = obj.get(objName)
				if not isinstance(val, bool):
					invalidCompositeInfo += f"\n due to non-bool {name}.{objName} indicator type: {type(val).__name__}"
					validComposite = False
			# schedules map must be dict[str,bool]
			objMap = obj.get("schedules")
			if not isinstance(objMap, dict):
				invalidCompositeInfo += f"\n due to non-dict {name}.schedules indicator type: {type(objMap).__name__}"
				validComposite = False
			else:
				for objID, flag in objMap.items():
					if not isinstance(flag, bool):
						invalidCompositeInfo += f"\n due to non-bool {name}.schedules.{objID} indicator type: {type(flag).__name__}"
						validComposite = False

	# key alignment between scheds and flag maps (only if all dicts)
	if isinstance(scheds, dict) and isinstance((dirty).get("schedules"), dict) and isinstance((toDelete).get("schedules"), dict):
		schedIDs       = sorted(scheds.keys())
		dirtySchedIDs  = sorted(dirty.get("schedules", {}).keys())
		deleteSchedIDs = sorted(toDelete.get("schedules", {}).keys())
		for nm, ids in (("dirty", dirtySchedIDs), ("toDelete", deleteSchedIDs)):
			if schedIDs != ids:
				invalidCompositeInfo += f"\n due to mismatched scheduleIDs between {nm}['schedules'] ({', '.join(ids)}) and schedules ({', '.join(schedIDs)})"
				validComposite = False

	# Check for completion misalignment
	if (dirty.get('completion', None) or toDelete.get('completion', None)) and not comp.get("_id", None):
		invalidCompositeInfo += "\n No completion _id"
		validComposite = False
	if toDelete.get('event', None) != toDelete.get('completion', None):
		invalidCompositeInfo += "\n toDelete['event'] != toDelete['completion]"
		validComposite = False
	eSchedID = event.get("scheduleID", None)
	eCompID = event.get("completionID", None)
	cSchedID = comp.get("scheduleID", None)
	cEventID = comp.get("eventID", None)
	cID = comp.get("_id", None)
	eID = event.get("_id", None)
	if eSchedID != cSchedID: # Event and completion should contain same scheduleID
		invalidCompositeInfo += "\n event and completion contain differing scheduleIDs"
		validComposite = False
	if eCompID != cID: # Event should contain correct completionID (could be None)
		invalidCompositeInfo += f"\n event contains incorrect completionID true({cID}) != joinID({eCompID})"
		validComposite = False
	if cEventID != eID: # Completion should contain correct eventID (could be None)
		invalidCompositeInfo += f"\n completion contains incorrect eventID true({eID}) != joinID({cEventID})"
		validComposite = False

	# Log full info about invalidity and return empty
	if not validComposite:
		logger.warning(invalidCompositeInfo)
		return jsonify({"form": {}, "event": {}, "schedules": [], "completion": []}), 400
	# endregion

	batch = db.batch()

	# region EVENT SAVE/DELETE
	eventID = event.pop("_id", None)
	compID = comp.pop("_id", None)
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
		
		if dirty['completion']: # include completion id with event
			event["completionID"] = compID

		batch.set(eventRef, { **_objsToDt(event), "ownerID": uID }, merge=True)
	elif dirty['completion'] and eventID:
		batch.set(eventsCo.document(eventID), {"completionID": compID, "ownerID": uID}, merge=True)

	# endregion

	# region COMPLETION REF/DELETE
	if toDelete['completion']:
		batch.delete(completionsCo.document(compID))
	elif dirty['completion']:
		logger.warning(f"Updating/creating completion: {comp.get('path')} ({compID})")
		compRef = completionsCo.document(compID)
		comp["eventID"] = eventID
		batch.set(compRef, { **_objsToDt(comp), "ownerID": uID }, merge=True)
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
		
			batch.set(schedRef, {**_objsToDt(sched), "ownerID": uID}, merge=True)
			updatedSchedIDs.append(schedID) # Record updated schedule IDs for read and return
	# endregion

	batch.commit()

	# region READ UPDATED OBJECTS AND CONFIRM DELETIONS
	deletions = {
		"event": None,
		"form": None,
		"completion": None,
		"schedules": deletedSchedIDs,
	}

	updatedCompletion = { '_id': None }
	if toDelete["completion"] and compID:
		deletions["completion"] = compID
	elif dirty["completion"]:
		compDoc = completionsCo.document(compID).get()
		updatedCompletion = { **_objsToIso(compDoc.to_dict()), "_id": compDoc.id }

	updatedEvent = { '_id': None }
	if toDelete["event"]:
		deletions["event"] = eventID
	elif dirty["event"]:
		eventDoc = eventsCo.document(eventID).get()
		updatedEvent = { **_objsToIso(eventDoc.to_dict()), "_id": eventDoc.id }

	updatedForm = { '_id': None }
	if toDelete["form"]:
		deletions["form"] = formID
	elif dirty["form"]:
		formDoc = formsCo.document(formID).get()
		updatedForm = { **formDoc.to_dict(), "_id": formDoc.id }

	updatedSchedules = []
	for sID in updatedSchedIDs:
		schedDoc = schedulesCo.document(sID).get()
		updatedSchedules.append({ **_objsToIso(schedDoc.to_dict()), "_id": schedDoc.id })

	# endregion

	return jsonify({ 
		"form": updatedForm, 
		"event": updatedEvent, 
		"completion": updatedCompletion, 
		"schedules": updatedSchedules, 
		"deletions": deletions 
	}), 200
