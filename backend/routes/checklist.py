from flask import Blueprint, request, jsonify
from auth import requireAuth
from db import db, checklistCo
from logger import getLogger
import uuid

logger = getLogger(__name__)

checklist = Blueprint("checklist", __name__)

@checklist.route("/checklist/active", methods=["GET"])
def getActive():
	uID, err = requireAuth()
	if err:
		return jsonify(*err), 401
	
	activeDocs = checklistCo.document(uID).collection("active").stream()
	items = [{**doc.to_dict(), "_id": doc.id} for doc in activeDocs]

	return jsonify(items), 200


# Not implemented yet
@checklist.route("/checklist/complete", methods=["GET"])
def getCompleted():
	uID, err = requireAuth()
	if err:
		return jsonify(*err), 401
	
	completeDocs = checklistCo.document(uID).collection("complete").stream()
	items = [{**doc.to_dict(), "_id": doc.id} for doc in completeDocs]

	return jsonify(items), 200


# Wait to render until return
@checklist.route("/checklist/add", methods=["POST"])
def addItem():
	uID, err = requireAuth()
	if err:
		return jsonify(*err), 401
	
	item = request.get_json(silent=True) or {}
	active = checklistCo.document(uID).collection("active")
	doc = active.document()
	doc.set(item)

	return jsonify({**doc, "_id": doc.id}), 201


@checklist.route("/checklist/complete/<item_id>", methods=["POST"])
def completeItem(item_id):
	uID, err = requireAuth()
	if err:
		return jsonify(*err), 401
	
	active = checklistCo.document(uID).collection("active")
	complete = checklistCo.document(uID).collection("complete")

	doc = active.document(item_id)
	compDoc = doc.get().to_dict() or {}
	complete.document(item_id).set(compDoc) # Create complete
	doc.delete() # Delete active
	
	return jsonify({"_id": item_id}), 200
