import logging
import json
import os
import datetime as dt
from google.oauth2 import service_account
from google.cloud.logging import Client as GcpClient
from google.cloud.logging.handlers import CloudLoggingHandler

devMode = True
LOGGER_CREDS = json.loads(os.environ.get("LOGGER_ADMIN_JSON", "{}"))

def getLogger(name):
	logger = logging.getLogger(name)
	level = logging.INFO if devMode else logging.DEBUG
	logger.setLevel(level)

	if not logger.handlers:
		if devMode:
			handler = logging.StreamHandler()
		else:
			creds = service_account.Credentials.from_service_account_info(LOGGER_CREDS)
			client = GcpClient(credentials=creds, project=creds.project_id)
			handler = CloudLoggingHandler(client, name=f"portia-backend-{dt.date.today().isoformat()}")

		fmt = "%(asctime)s %(levelname)-8s %(name)s:: %(message)s"
		handler.setFormatter(logging.Formatter(fmt))
		logger.addHandler(handler)

	return logger
