# backend/routes/schedules
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from backend.firebase import schedulesCo, db
from backend.auth import handleFirebaseAuth
from backend.logger import logRequests, getLogger
from backend.helpers import _objsToIso

logger = getLogger(__name__)
schedulesBP = Blueprint("schedules", __name__, url_prefix="/schedules")

@schedulesBP.route("", methods=["GET"])
@logRequests
@handleFirebaseAuth
def listSchedules(uID):
	logger.info(f"GET schedules")
	docs = schedulesCo.where("ownerID", "==", uID).stream()
	scheds = [{**d.to_dict(), "_id": d.id} for d in docs]
	return jsonify(_objsToIso(scheds)), 200