# backend/routes/forms.py
from flask import Blueprint, jsonify, request
from datetime import datetime, timezone
from backend.firebase import formsCo
from backend.auth import handleFirebaseAuth
from backend.logger import logRequests, getLogger

logger = getLogger(__name__)
formsBP = Blueprint("forms", __name__, url_prefix="/forms")

@formsBP.route("", methods=["GET"])
@logRequests
@handleFirebaseAuth
def listForms(uID):
	docs = formsCo.where("ownerID", "==", uID).stream()
	return jsonify([{**d.to_dict(), "_id": d.id} for d in docs]), 200


@formsBP.route("", methods=["POST"])
@logRequests
@handleFirebaseAuth
def createForm(uID):
	form = request.get_json() or {}
	ref = formsCo.document()
	form.update({"ownerID": uID })
	ref.set(form)
	return jsonify({**form, "_id": ref.id}), 201


@formsBP.route("/<docID>", methods=["PUT"])
@logRequests
@handleFirebaseAuth
def updateForm(uID, docID):
	ref = formsCo.document(docID)
	doc = ref.get()
	if not doc.exists or doc.to_dict().get("ownerID") != uID:
		return jsonify({"error": "Not auth"}), 403
	ref.set(request.get_json() or {}, merge=True)
	out = ref.get()
	return jsonify({**out.to_dict(), "_id": docID}), 200


@formsBP.route("/<docID>", methods=["DELETE"])
@logRequests
@handleFirebaseAuth
def deleteForm(uID, docID):
	ref = formsCo.document(docID)
	doc = ref.get()
	if not doc.exists or doc.to_dict().get("ownerID") != uID:
		return jsonify({"error": "Not auth"}), 403
	ref.delete()
	return jsonify({"_id": docID}), 200
