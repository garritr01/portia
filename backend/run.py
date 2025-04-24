from flask import Flask, make_response, request
from flask_cors import CORS
from config import devMode, PORT, CORS_ORIGINS
from db import initCollections
from logger import getLogger

app = Flask(__name__)
CORS(app, origins=CORS_ORIGINS, supports_credentials=True)
logger = getLogger(__name__)


#@app.before_request
#def handle_preflight():
#	if request.method == "OPTIONS":
#		resp = make_response()
#		resp.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
#		resp.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
#		resp.headers["Access-Control-Allow-Headers"] = "Authorization,Content-Type"
#		return resp, 200


import routes.eventPOST
import routes.eventGET
import routes.checklist
import routes.users

initCollections()

if __name__ == "__main__":
	logger.info(f"Starting app in {devMode}")
	app.run(debug=devMode, host="0.0.0.0", port=PORT)
