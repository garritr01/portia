from functools import wraps
from flask import request, jsonify, abort
import firebase_admin
from firebase_admin import auth, credentials
from backend.config import FIREBASE_CREDS
from backend.logger import getLogger

logger = getLogger(__name__)

if not firebase_admin._apps:
	cred = credentials.Certificate(FIREBASE_CREDS)
	firebase_admin.initialize_app(cred)

def requireAuth():
	"""
	Check the token w/ Firebase
	"""
	header = request.headers.get("Authorization", "")
	if not header.startswith("Bearer "):
		return None, ({"error": "Bearer missing"}, 401)

	token = header.split(" ", 1)[1]
	if not token:
		return None, ({"error": "Firebase found no token"}, 401)

	try:
		decoded = auth.verify_id_token(token, check_revoked=True)
		uid = decoded.get("uid")
		if not uid:
			raise ValueError("UID not found in token")
	except Exception as e:
		return None, ({"error": f"Token verification failed: {e}"}, 401)

	return uid, None

# requireAuth but decorator
def handleFirebaseAuth(f):

	@wraps(f)
	def wrapper(*args, **kwargs):
		uid, err = requireAuth()
		if err:
			payload, status = err
			return jsonify(payload), status
		request.uid = uid
		return f(uid, *args, **kwargs)

	return wrapper
