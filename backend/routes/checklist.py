from flask import Blueprint, request, jsonify
from backend.auth import handleFirebaseAuth
from backend.firebase import checklistCo
from backend.logger import getLogger, logRequests

logger = getLogger(__name__)

checklistBP = Blueprint("checklist", __name__, url_prefix="/checklist")

@checklistBP.route("", methods=["GET"])
@logRequests
@handleFirebaseAuth
def getActive(uID):
	"""
	Get all active checklist items the user is a part of.
	"""
	# only active items where user is participant
	q = (
		checklistCo
			.where("active", "==", True)
			.where("participants", "array_contains", uID)
	)
	docs = q.stream()
	items = [{**doc.to_dict(), "_id": doc.id} for doc in docs]
	logger.debug(f"Found {len(items)} checklist items for user.")
	return jsonify(items), 200

""" getComplete() Implement when filesystem view is implemented
@checklistBP.route("/complete", methods=["GET"])
def getCompleted():
	uID = request.uid
	
	completeDocs = checklistCo.document(uID).collection("complete").stream()
	items = [{**doc.to_dict(), "_id": doc.id} for doc in completeDocs]

	return jsonify(items), 200
"""

@checklistBP.route("/new", methods=["POST"])
@logRequests
@handleFirebaseAuth
def addItem(uID):
	# Validate payload
	item = request.get_json()
	if not item:
		logger.debug("Missing checklist item")
		return jsonify({"error": "Missing checklist item"}), 400
	elif not isinstance(item, dict):
		logger.debug("Checklist item not dictionary")
		return jsonify({"error": "Checklist item not dictionary"}), 400
	
	# Handle permissions info
	item["ownerID"] = uID
	parts = item.get("participants")
	if not isinstance(parts, list):
		parts = []
	if uID not in parts:
		parts.append(uID)
	item["participants"] = parts

	try:
		time, ref = checklistCo.add(item)
		newDoc = { **item, "_id": ref.id }
		logger.debug(f"Created checklist item '{newDoc['title']}'")
		return jsonify(newDoc), 201
	except Exception as e:
		logger.exception(f"Creating new checklist item failed\n {e} ")
		return jsonify({ "error": str(e) }), 500


@checklistBP.route("/<docID>", methods=["PUT"])
@logRequests
@handleFirebaseAuth
def updateItem(uID, docID): # participants later?

	ref = checklistCo.document(docID)
	doc = ref.get()
	if not doc.exists:
		return jsonify({ "error": "No doc found to update" }), 404
	content = doc.to_dict()
	if uID != content.get("ownerID"):
		return jsonify({ "error": "User not permitted to edit item" }), 403
	
	changes = request.get_json() or None
	if not changes or not isinstance(changes, dict):
		return jsonify({ "error": "Checklist updates must be non-empty object" }), 400
	
	# Participant can't change ownerID
	changes.pop("ownerID", None)
	
	try:
		ref.update(changes)
		response = ref.get()
		newDoc = { **response.to_dict(), "_id": response.id }
		logger.debug(f"Updated checklist item '{newDoc['title']}'")
		return jsonify(newDoc), 200
	except Exception as e:
		logger.exception(f"Updating checklist item failed...\n {e}")
		return jsonify({ "error": str(e) }), 500


@checklistBP.route("/<docID>", methods=["DELETE"])
@logRequests
@handleFirebaseAuth
def deleteItem(uID, docID):

	ref = checklistCo.document(docID)
	doc = ref.get()
	if not doc.exists:
		return jsonify({ "error": "No doc to delete" }), 404
	content = doc.to_dict()
	if uID != content.get("ownerID"):
		return jsonify({ "error": "User not auth to delete" }), 403
	
	try:
		ref.delete()
		logger.debug(f"Deleted checklist item '{content['title']}'")
		return jsonify({"_id": docID}), 200
	except Exception as e:
		logger.exception(f"Deleting checklist item failed...\n {e}")
		return jsonify({ "error": str(e) }), 500
