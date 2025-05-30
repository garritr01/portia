from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from backend.firebase import recurCo, formsCo, db
from backend.auth import handleFirebaseAuth
from backend.logger import logRequests, getLogger

logger = getLogger(__name__)
recursBP = Blueprint("recurs", __name__, url_prefix="/recurs")

@recursBP.route("", methods=["GET"])
@logRequests
@handleFirebaseAuth
def listRecurs(uID):
	return


@recursBP.route("", methods=["POST"])
@logRequests
@handleFirebaseAuth
def createRecur(uID):
	return
