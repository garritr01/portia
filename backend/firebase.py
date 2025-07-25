# backend/firebase.py

import os
import firebase_admin
from firebase_admin import credentials, firestore
from backend.config import FIREBASE_CREDS

# Init Firebase SDK
if not firebase_admin._apps:
	cred = credentials.Certificate(FIREBASE_CREDS)
	firebase_admin.initialize_app(cred)

# Init db and get collections for distributing to routes
db = firestore.client()
formsCo = db.collection("forms")
eventsCo = db.collection("events")
pathsCo = db.collection("paths") # Implement later
summariesCo = db.collection("summaries") # Maybe implement later
schedulesCo = db.collection("schedules")
checklistCo = db.collection("checklist")
usersCo = db.collection("users")
