# backend/routes/testConn.py

from flask import Blueprint, jsonify, request, abort
from firebase_admin import auth
from backend.auth import handleFirebaseAuth
from backend.logger import getLogger, logRequests

testBP = Blueprint("test", __name__, url_prefix="/test")
logger = getLogger(__name__)

@testBP.route("/conn", methods=["GET"])
@logRequests
def testConn():
	"""
	Check connection from front to back
	"""
	logger.debug("testConn endpoint hit")
	return jsonify({"message": "Hello from backend!"}), 200


@testBP.route("/auth", methods=["GET"])
@handleFirebaseAuth
@logRequests
def testAuth(uID):
	"""
	Auth check
	"""
	try:
		userInfo = auth.get_user(uID)
		email = userInfo.email
		return jsonify({"message": f"testAuth succeeded for user: {email}"}), 200
	except auth.UserNotFoundError as e:
		return jsonify({"error": "Auth succeeded, but no email found" }), 404
