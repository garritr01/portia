# backend/migrations/ensure_app.py
import os, json, firebase_admin
from firebase_admin import credentials

def ensure_app():
	if firebase_admin._apps:
		return firebase_admin.get_app()
	raw = os.getenv("FIREBASE_ADMIN_JSON")
	if raw:
		cred = credentials.Certificate(json.loads(raw))
		return firebase_admin.initialize_app(cred)
	return firebase_admin.initialize_app(credentials.ApplicationDefault())
