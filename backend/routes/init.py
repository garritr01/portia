from flask import Flask
from flask_cors import CORS
from logger import getLogger
from routes.eventGET import eventGET
from routes.eventPOST import eventPOST
from routes.checklist import checklist
from routes.users import users

logger = getLogger(__name__)

def create_app():
	app = Flask(__name__)

	from config import devMode, PORT, CORS_ORIGINS

	app.config.update(devMode=devMode, PORT=PORT)
	CORS(app, origins=CORS_ORIGINS, supports_credentials=True)

	import db, logger

	for bp in (users, eventGET, eventPOST, checklist):
		app.register_blueprint(bp)

	return app
