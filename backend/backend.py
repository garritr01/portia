import firebase_admin
from firebase_admin import credentials, auth, firestore
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import os
from dotenv import load_dotenv

# SET TO FALSE FOR DEPLOYMENT
devMode = False

# Start Flask app
app = Flask(__name__)
if devMode:
	CORS(app, origins=["https://portia-wispy-field-3605.fly.dev"])
else:
	CORS(app, origins=["http://localhost:3000"])

# Initialize Firebase w credentials
# authDir = Path("/mnt/c/Users/garri/Documents/SS2025/CIS658-WA/portiaApp/auth")
load_dotenv()
cred = credentials.Certificate({
  "type": "service_account",
  "project_id": os.getenv("FIREBASE_PROJECT_ID"),
  "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
  "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace("\\n", "\n"),
  "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
  "client_id": os.getenv("FIREBASE_CLIENT_ID"),
  "auth_uri": os.getenv("FIREBASE_AUTH_URI"),
  "token_uri": os.getenv("FIREBASE_TOKEN_URI"),
  "auth_provider_x509_cert_url": os.getenv("FIREBASE_AUTH_PROVIDER_CERT_URL"),
  "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_CERT_URL"),
})
firebase_admin.initialize_app(cred)

# Define Firestore variables
db = firestore.client()
collections = db.collections()
checklist_ref = db.collection("checklist-p-1-2")

@app.route("/", methods=["GET"])
def test():
	return "Hello from portia backend :)"

# Get user id from token
def verify_token(id_token):
	try:
		decoded_token = auth.verify_id_token(id_token)
		uid = decoded_token["uid"]
		return uid
	except Exception as e:
		print(f"Error verifying token: {e}")
		return None

# Check user authentication
@app.route("/verify_user", methods=["POST"])
def verify_user():
	id_token = request.json.get("id_token")
	if not id_token:
		return jsonify({"error": "ID token is missing"}), 400
	uid = verify_token(id_token)
	if uid:
		return jsonify({"status": "Authenticated", "user_id": uid}), 200
	else:
		return jsonify({"error": "Invalid ID token"}), 401


# Get full checklist
@app.route("/checklist", methods=["GET"])
def get_checklist():
	try:
		docs = checklist_ref.stream()
		items = []
		for doc in docs:
			item = doc.to_dict()
			item["id"] = doc.id
			items.append(item)
		return jsonify(items), 200
	except Exception as e:
		return jsonify({"error": str(e)}), 500


# Add a new checklist item
@app.route("/checklist", methods=["POST"])
def add_checklist_item():
	try:
		data = request.get_json()
		if not data.get("name"):
			return jsonify({"error": "Name is required"}), 400
		new_item = {"name": data["name"], "completed": False}
		doc_ref = checklist_ref.add(new_item) # Add item to Firestore
		new_item["id"] = doc_ref.id  # Add Firestore ID to response
		return jsonify(new_item), 201
	except Exception as e:
		return jsonify({"error": str(e)}), 500


# Update a checklist item
@app.route("/checklist/<item_id>", methods=["PUT"])
def update_checklist_item(item_id):
	try:
		data = request.get_json()
		name = data.get("name")
		completed = data.get("completed")

		# Define content to update
		updateContent = {}
		if name is not None:
			updateContent["name"] = name
		if completed is not None:
			print('compl', completed)
			updateContent["completed"] = completed
			
		# Update the in Firestore
		doc_ref = checklist_ref.document(item_id)
		doc_ref.update(updateContent)

		# Return updated item
		updated_item = doc_ref.get().to_dict()
		updated_item["id"] = doc_ref.id
		return jsonify(updated_item), 200
	except Exception as e:
		return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
	if devMode:
		app.run(debug=True)
	else:
		pass
