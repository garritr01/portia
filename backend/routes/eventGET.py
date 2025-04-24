from flask import Blueprint, jsonify, request
from auth import requireAuth
from db import eventsCo, formsCo, recurrencesCo, summariesCo
from helpers import docAndID
from logger import getLogger

logger = getLogger(__name__)

eventGET = Blueprint("eventsGET", __name__)

@eventGET.route("/events", methods=["GET"])
def listEvents():
	uID, err = requireAuth()
	if err:
		return jsonify(*err)
	print(uID)

	# events at least partially in range
	userEvents = eventsCo.document(uID).collection("userEvents")
	start = request.args.get("start")
	end   = request.args.get("end")
	print(start, end)
	if start and end:
		query = query \
			.where("startStamp", "<", start) \
			.where("endStamp", ">=", start) \
			.where("endStamp", "<=", end)
		
	docs = query.order_by("endStamp")

	return jsonify([docAndID(d) for d in docs])

@eventGET.route("/events/<event_id>", methods=["GET"])
def getEvent(event_id):
	uID, err = requireAuth()
	if err:
		return jsonify(*err)
	ref = eventsCo.document(uID).collection("userEvents").document(event_id)
	snap = ref.get()
	if not snap.exists:
		return jsonify({"ok": False, "error": "Event not found"}), 404
	return jsonify(docAndID(snap))

@eventGET.route("/forms", methods=["GET"])
def listForms():
	uID, err = requireAuth()
	if err:
		return jsonify(*err)
	docs = formsCo.document(uID).collection("userForms").stream()
	return jsonify([docAndID(d) for d in docs])

@eventGET.route("/forms/<form_id>", methods=["GET"])
def getForm(form_id):
	uID, err = requireAuth()
	if err:
		return jsonify(*err)
	ref = formsCo.document(uID).collection("userForms").document(form_id)
	snap = ref.get()
	if not snap.exists:
		return jsonify({"ok": False, "error": "Form not found"}), 404
	return jsonify(docAndID(snap))

@eventGET.route("/recurrences", methods=["GET"])
def listRecurrences():
	return None
