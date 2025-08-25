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
	logger.info("GET forms")
	docs = formsCo.where("ownerID", "==", uID).stream()
	forms = [{**d.to_dict(), "_id": d.id} for d in docs]
	return jsonify(forms), 200

