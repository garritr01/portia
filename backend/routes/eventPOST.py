from flask import Blueprint, request, jsonify
from auth import requireAuth
from db import db, formsCo, eventsCo, pathsCo, summariesCo, recurrencesCo
from helpers import docAndID
from logger import getLogger
from google.cloud.firestore import Increment

eventPOST = Blueprint("eventPOST", __name__)
logger = getLogger(__name__)

@eventPOST.route("/events", methods=["POST"])
def updateEvent(tutorial = False):
	"""
	Handle entire flow of event creation or update
	"""

	uID, err = requireAuth()
	if err:
		return jsonify(err), 401

	event = request.get_json()

	# Initialize user subcollections
	if tutorial:
		eventsCo.document(uID).set({}, merge=True)
		formsCo.document(uID).set({}, merge=True)
		recurrencesCo.document(uID).set({}, merge=True)
		summariesCo.document(uID).set({}, merge=True)

	# Define references to uID indexed subcollections
	userEvents = eventsCo.document(uID).collection("userEvents") 
	userForms = formsCo.document(uID).collection("userForms")
	userRecurrences = recurrencesCo.document(uID).collection("userRecurrences")
	userSummaries = summariesCo.document(uID).collection("userSummaries")
	
	# Pull out frequently used attributes
	ePath = event.get('path', '')
	eForm = event.pop('form', {})
	startStamp = event.get("startStamp", None)
	eRecurrence = event.pop('recurrence', {})
	event['recurrenceID'] = eRecurrence.get('_id', None)

	# Batch update, to avoid any changes if something errs
	batch = db.batch()
	try:

		# Form update block
		try:
			# Create or update form if changes
			formID = eForm.get("_id", None) # Get ID here for use in event
			if eForm.get("update", False):
				formInfo = []
				# Strip the content
				for element in event.get("info", []):
					item = element.copy()
					item["content"] = ""
					formInfo.append(item)

				# Denote whether start included
				includeStart = True if startStamp == event.get("endStamp", 0) else False

				# Get existing or new doc
				if formID:
					formDoc = userForms.document(formID)
				else:
					formDoc = userForms.document()

				# Update or create the form info and includeStart
				batch.set(
					formDoc, 
						{ 
							"path": ePath,
							"info": formInfo, 
							"includeStart": includeStart,
							"recurrenceID": eRecurrence.get("_id", None)
						}, 
					merge=True
				)

				logger.info(f"Updated form for {'/'.join(event.get('path', ''))}")
				formID = formDoc.id

			else:
				logger.info(f"No form updates required for {'/'.join(event.get('path', ''))}")
		except Exception as e:
			logger.exception(f"Failed attempting to update form for {'/'.join(ePath)}")
			return jsonify({ "ok": False, "error": f"{'/'.join(ePath)} form update error: {str(e)}" }), 500
		
		# Event update block
		try:
			eventID = event.pop('_id', None)
			if eventID:
				eventDoc = userEvents.document(eventID)
			else:
				eventDoc = userEvents.document()

			# Update or create the event
			batch.set(eventDoc, event, merge=True)
			logger.info(f"Updated event for {'/'.join(event.get('path', ''))}")
			eventID = eventDoc.id
		except Exception as e:
			logger.exception(f"Failed attempting to update event for {'/'.join(ePath)}")
			return jsonify({ "ok": False, "error": f"{'/'.join(ePath)} event update error: {str(e)}" }), 500
		
		# Summary update block - NOTE -time change breaks this, just doing it for EST for now :(
		try:
			if startStamp:
				# Get the date bucket for storing counts and make sure it exists
				dateDoc = userSummaries.document(startStamp.date().isoformat())

				# For each 'nesting level' increment the path
				for i in range(len(ePath)):
					currentPath = '/'.join(ePath[:i])
					batch.set(dateDoc, { "counts": Increment(1) }, merge=True) # Increment each path level

				logger.info(f"Incremented summaries for {'/'.join(ePath)}")
			else:
				logger.warning("Summaries found no startStamp.")
		except Exception as e:
			logger.exception(f"Failed attempting to update summary for {'/'.join(ePath)}")
			return jsonify({ "ok": False, "error": f"{'/'.join(ePath)} summary update error: {str(e)}" }), 500

		# Recurrence update block, update if indicated, frontend logic handling
		try:
			if eRecurrence.get('updated', False):
				recurID = eRecurrence.pop('_id', False)
				if recurID:
					recDoc = userRecurrences.document(recurID)
				else:
					recDoc = userRecurrences.document()
				batch.set(recDoc, eRecurrence, merge=True)
				logger.info(f"Updated recurrence for {'/'.join(ePath)}")
			else:
				logger.info("Recurrence not updated.")
		except Exception as e:
			logger.exception(f"Failed attempting to update summary for {'/'.join(ePath)}")
			return jsonify({ "ok": False, "error": f"{'/'.join(ePath)} summary update error: {str(e)}" }), 500

		# NOTE - eventually add filesystem into the equation

		batch.commit()
		logger.info(f"Updated all necessary event related docs.")
		return jsonify({"ok": True}), 201

	except Exception as e:
		logger.exception("Failed somewhere in event")
		return jsonify({ "ok": False, "error": f"Unspecified error in event update: {str(e)}" }), 500

@eventPOST.route("/events/<event_id>", methods=["DELETE"])
def deleteEvent(event_id):
	uID, err = requireAuth()
	if err:
		return jsonify(*err)

	userEvents = eventsCo.document(uID).collection("userEvents")
	userSummaries = summariesCo.document(uID).collection("userSummaries")

	eventDoc = userEvents.document(event_id).get()
	content = eventDoc.to_dict()

	batch = db.batch()
	batch.delete(eventDoc)

	startStamp = data.get("startStamp")
	if startStamp:
		dateKey  = startStamp[:10]               # "YYYY-MM-DD"
		dateDoc  = userSummaries.document(dateKey)
		batch.set(dateDoc, {"counts": Increment(-1)}, merge=True)

	batch.commit()
	logger.info(f"Deleted event {event_id}")
	return jsonify({"ok": True})

@eventPOST.route("/forms/<form_id>", methods=["DELETE"])
def deleteForm(form_id):
	uID, err = requireAuth()
	if err:
		return jsonify(*err)

	userForms = formsCo.document(uID).collection("userForms")
	userRecurrences = recurrencesCo.document(uID).collection("userRecurrences")

	formDoc = userForms.document(form_id)
	snap = formDoc.get()
	if not snap.exists:
		return jsonify({"ok": False, "error": "Form not found"}), 404
	data = snap.to_dict()

	recurrenceID = data.get("recurrenceID")

	batch = db.batch()
	batch.delete(formDoc)

	# cascade-delete recurrence if present
	if recurrenceID:
		batch.delete(userRecurrences.document(recurrenceID))

	batch.commit()
	logger.info(f"Deleted form {form_id} and recurrence {recurrenceID or '(none)'}")
	return jsonify({"ok": True})


def deleteRecurrence(recur_id):
	
	uID, err = requireAuth()
	if err:
		return jsonify(*err)

	userRecurrences = recurrencesCo.document(uID).collection("userRecurrences")
	recDoc = userRecurrences.document(recur_id)

	if not recDoc.get().exists:
		return jsonify({"ok": False, "error": "Recurrence not found"}), 404

	recDoc.delete()
	logger.info(f"Deleted recurrence {recur_id}")
	return jsonify({"ok": True})
