import time
import firebase_admin
from firebase_admin import credentials
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from backend.logger import getLogger
from backend.config import (
	DEBUG,
	SECRET_KEY,
	PORT,
	CORS_ORIGINS,
	FIREBASE_CREDS,
	LOGGER_CREDS
)

logger = getLogger(__name__)
exceptLogger = getLogger('exceptions')

def createApp():
	app = Flask(__name__)
	app.config["DEBUG"] = DEBUG
	app.config["SECRET_KEY"] = SECRET_KEY
	app.config["PORT"] = PORT

	if FIREBASE_CREDS:
		cred = credentials.Certificate(FIREBASE_CREDS)
	else:
		cred = credentials.ApplicationDefault()
	firebase_admin.initialize_app(cred)

	CORS(
		app,
		origins=CORS_ORIGINS,
		supports_credentials=True,
		intercept_exceptions=True,
		allow_headers=["Content-Type", "Authorization"],
		methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	)

	# Allow all options methods for better debugging in dev
	#if app.config["DEBUG"]:
	#	@app.before_request
	#	def handle_preflight():
	#		if request.method == "OPTIONS":
	#			logger.debug(f"Dev preflight skip: {request.path}")
	#			return "", 200

	# Global HTTP exception handler
	@app.errorhandler(HTTPException)
	def handleExceptionsHTTP(e):
		# .exception if you want more info (way more lines)
		exceptLogger.exception(f"{request.path}:{e.name}: {e.description}")
		return jsonify({
			"error": e.name,
			"message": e.description
		}), e.code
	
	# Global unknown exception handler
	@app.errorhandler(Exception)
	def handleExceptions(e):
		# .exception if you want more info (way more lines)
		exceptLogger.exception(f"!! 500 !! {request.method} {request.path} uid={getattr(request, 'uid', None)}")
		return jsonify({
			"error": "Unknown Exception",
			"message": f"Unknown failure in {request.method} {request.path}"
		}), 500

	# Note state of env variables
	logger.debug(f"Starting app on port {PORT}, allowing CORS from {', '.join(CORS_ORIGINS)}")
	logger.debug(f"Found Firebase credentials" if FIREBASE_CREDS else f"Did not find Firebase credentials")
	logger.debug(f"Found logger credentials" if LOGGER_CREDS else f"Did not find logger credentials")
	logger.debug(f"Found secret key" if SECRET_KEY else f"Did not find secret key")

	# Import and reg blueprints
	from backend.routes.test import testBP
	from backend.routes.checklist import checklistBP
	from backend.routes.composite import compositeBP
	from backend.routes.forms import formsBP
	from backend.routes.events import eventsBP
	from backend.routes.schedules import schedulesBP
	
	app.register_blueprint(testBP)
	app.register_blueprint(checklistBP)
	app.register_blueprint(compositeBP)
	app.register_blueprint(formsBP)
	app.register_blueprint(eventsBP)
	app.register_blueprint(schedulesBP)

	return app
