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
recurCo = db.collection("rRules")
checklistCo = db.collection("checklist")
usersCo = db.collection("users")

# Not needed anymore as subcollections not used anymore
#def initCollections():
#	"""
#	Optionally seed each collection with a dummy _init doc.
#	"""
#	for co in (
#		formsCo,
#		eventsCo,
#		pathsCo,
#		summariesCo,
#		recurrencesCo,
#		checklistCo,
#		usersCo,
#	):
#		co.document("_init").set({"setup": True}, merge=True)
#
