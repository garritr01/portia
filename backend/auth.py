from flask import request
from firebase_admin import auth

def requireAuth():
	"""
	Authenticate based 'Bearer ...' token
	"""
	print('in rq auth')
	header = request.headers.get("Authorization","")
	if not header.startswith("Bearer "):
		print("Bearer not present." )
		return None, ({ "error": "Bearer not present." }, 401)
	
	token = header.split(" ", 1)[1]
	if not token:
		print("No token.")
		return None, ({ "error": "No token." }, 401)
	
	try:
		uID =  auth.verify_id_token(token).get("uid", None)
	except Exception as e:
		print(f"Token verification failure: {e}")
		return None, ({ "error": f"Token verification failure: {e}" }, 401)
	
	return uID, None
