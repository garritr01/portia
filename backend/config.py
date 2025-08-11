import os
import json

# devMode based on Flask
devMode = os.getenv("FLASK_ENV", "development") == "development"
DEBUG = devMode

SECRET_KEY = os.getenv("SECRET_KEY", os.urandom(32))

PORT = int(os.getenv("PORT", 5000))

corigins = '["http://localhost:3000"]' if devMode else '["https://your-frontend-domain.com"]'
CORS_ORIGINS = json.loads(os.getenv("CORS_ORIGINS", corigins))

FIREBASE_CREDS = json.loads(os.getenv("FIREBASE_ADMIN_JSON", "{}"))
LOGGER_CREDS   = json.loads(os.getenv("LOGGER_ADMIN_JSON", "{}"))

MASS_MIGRATE = None

