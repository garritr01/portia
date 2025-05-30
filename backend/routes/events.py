# backend/routes/eventsBP.py
from flask import Blueprint, jsonify, request
from backend.firebase import eventsCo
from backend.auth import handleFirebaseAuth
from backend.logger import logRequests, getLogger
from backend.routes.composite import upsertComposite

logger = getLogger(__name__)
eventsBP = Blueprint("events", __name__, url_prefix="/events")


@eventsBP.route("", methods=["GET"])
@logRequests
@handleFirebaseAuth
def listEvents(uID):
	docs = eventsCo.where("ownerID", "==", uID).stream()
	return jsonify([{**d.to_dict(), "_id": d.id} for d in docs]), 200


@eventsBP.route("", methods=["POST", "PUT"])
@logRequests
@handleFirebaseAuth
def upsertEventComposite(uID):
	ids = upsertComposite(request.get_json() or {}, uID)
	return jsonify(ids), 200


@eventsBP.route("/<docID>", methods=["DELETE"])
@logRequests
@handleFirebaseAuth
def deleteEvent(uID, docID):
	ref = eventsCo.document(docID)
	doc = ref.get()
	if not doc.exists or doc.to_dict().get("ownerID") != uID:
		return jsonify({"error": "Permission denied by uID"}), 403
	ref.delete()
	return jsonify({"_id": docID}), 200
