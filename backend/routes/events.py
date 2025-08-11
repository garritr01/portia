# backend/routes/eventsBP.py
from flask import Blueprint, jsonify, request
from backend.firebase import eventsCo
from backend.auth import handleFirebaseAuth
from backend.logger import logRequests, getLogger
from backend.helpers import _to_dt, _convertStamps2ISOString

logger = getLogger(__name__)
eventsBP = Blueprint("events", __name__, url_prefix="/events")

@eventsBP.route("", methods=["GET"])
@logRequests
@handleFirebaseAuth
def listEvents(uID):
	start = request.args.get("start", None)
	end = request.args.get("end", None)

	logger.info(f"GET events in range {_to_dt(start)} - {_to_dt(end)}")

	q = eventsCo.where("ownerID", "==", uID)
	if start:
		q = q.where("endStamp", ">=", _to_dt(start))
	
	docs = list(q.stream())
	events = [{**d.to_dict(), "_id": d.id} for d in docs]
	if end:
		events = [e for e in events if e.get("startStamp") and e["startStamp"] < _to_dt(end)]

	return jsonify(_convertStamps2ISOString(events)), 200
