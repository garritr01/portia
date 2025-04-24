import os
import json

devMode = True
PORT = int(os.getenv("PORT", 5000))
CORS_ORIGINS = ["http://localhost:3000"] if devMode else ["https://portia-backend"]

FIREBASE_CREDS = json.loads(os.environ.get("FIREBASE_ADMIN_JSON", "{}"))

