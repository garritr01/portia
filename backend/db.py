import firebase_admin
from firebase_admin import credentials, firestore
from config import FIREBASE_CREDS

if not firebase_admin._apps:
	cred = credentials.Certificate(FIREBASE_CREDS)
	firebase_admin.initialize_app(cred)

db = firestore.client()
formsCo = db.collection("forms")
eventsCo = db.collection("events")
pathsCo = db.collection("paths")
summariesCo = db.collection("summaries")
recurrencesCo = db.collection("recurrences")
checklistCo = db.collection("checklist")
usersCo = db.collection("users")

def initCollections():
	for co in (formsCo, eventsCo, pathsCo, summariesCo, recurrencesCo, checklistCo, usersCo):
		co.document("_init").set({"setup": True}, merge=True)
