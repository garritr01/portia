# backend/routes/schedules
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from backend.firebase import schedulesCo, db
from backend.auth import handleFirebaseAuth
from backend.logger import logRequests, getLogger

logger = getLogger(__name__)
schedulesBP = Blueprint("schedules", __name__, url_prefix="/schedules")

@schedulesBP.route("", methods=["GET"])
@logRequests
@handleFirebaseAuth
def listSchedules(uID):
	docs = schedulesCo.where("ownerID", "==", uID).stream()
	return jsonify([{**d.to_dict(), "_id": d.id} for d in docs]), 200


@schedulesBP.route("", methods=["POST"])
@logRequests
@handleFirebaseAuth
def createSchedule(uID):
	schedule = request.get_json() or {}
	ref = schedulesCo.document()
	schedule.update({"ownerID": uID })
	ref.set(schedule)
	return jsonify({**schedule, "_id": ref.id}), 201


@schedulesBP.route("/<docID>", methods=["PUT"])
@logRequests
@handleFirebaseAuth
def updateSchedule(uID, docID):
	ref = schedulesCo.document(docID)
	doc = ref.get()
	if not doc.exists or doc.to_dict().get("ownerID") != uID:
		return jsonify({"error": "Not auth"}), 403
	ref.set(request.get_json() or {}, merge=True)
	out = ref.get()
	return jsonify({**out.to_dict(), "_id": docID}), 200


@schedulesBP.route("/<docID>", methods=["DELETE"])
@logRequests
@handleFirebaseAuth
def deleteSchedule(uID, docID):
	ref = schedulesCo.document(docID)
	doc = ref.get()
	if not doc.exists or doc.to_dict().get("ownerID") != uID:
		return jsonify({"error": "Not auth"}), 403
	ref.delete()
	return jsonify({"_id": docID}), 200
