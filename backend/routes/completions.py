# backend/routes/completions.py

from flask import Blueprint, jsonify, request
from backend.firebase import completionsCo
from backend.auth import handleFirebaseAuth
from backend.logger import logRequests, getLogger
from backend.helpers import _isoToDt, _objsToIso

logger = getLogger(__name__)
completionsBP = Blueprint("completions", __name__, url_prefix="/completions")

@completionsBP.route("", methods=["GET"])
@logRequests
@handleFirebaseAuth
def listCompletions(uID):
	start = request.args.get("start", None)
	end = request.args.get("end", None)

	logger.info(f"GET completions in range {_isoToDt(start)} - {_isoToDt(end)}")

	q = completionsCo.where("ownerID", "==", uID)
	if start:
		q = q.where("endStamp", ">=", _isoToDt(start))
	
	docs = list(q.stream())
	completions = [{**d.to_dict(), "_id": d.id} for d in docs]
	if end:
		completions = [e for e in completions if e.get("startStamp") and e["startStamp"] < _isoToDt(end)]

	logger.info(f"GET completions found {len(completions)} objects");

	return jsonify(_objsToIso(completions)), 200
