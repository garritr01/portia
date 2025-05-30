# backend/logger.py

import logging
import os
import json
import datetime as dt
import time
from functools import wraps
from flask import request
from google.oauth2 import service_account
from google.cloud.logging import Client as GcpClient
from google.cloud.logging.handlers import CloudLoggingHandler

devMode = os.getenv("FLASK_ENV", "development") == "development"
LOGGER_CREDS = json.loads(os.getenv("LOGGER_ADMIN_JSON", "{}"))

class RequestFilter(logging.Filter):
	"""
	Adds request.uid to all requests
	"""
	def filter(self, record):
		try:
			record.uid = getattr(request, "uid", "anon")
		except RuntimeError:
			record.uid = "no-request"
		return True

def getLogger(name):
	logger = logging.getLogger(name)
	if logger.handlers:
		return logger

	level = logging.DEBUG if devMode else logging.INFO
	logger.setLevel(level)

	if devMode:
		# log to console in dev
		consoleHandler = logging.StreamHandler()
		consoleFmt     = "=======> %(levelname)-8s [%(name)s:%(lineno)d] :: %(message)s"
		consoleHandler.setFormatter(logging.Formatter(consoleFmt))
		consoleHandler.addFilter(RequestFilter())
		logger.addHandler(consoleHandler)

		# log to file in dev
		os.makedirs("backend/logs", exist_ok=True)
		logPath = os.path.join("backend/logs", f"{name}.txt")
		fileHandler = logging.FileHandler(logPath)
		fileFmt = "(%(asctime)s) %(levelname)-8s [%(name)s]:: uID=%(uid)s :: %(message)s"
		fileHandler.setFormatter(logging.Formatter(fileFmt))
		fileHandler.addFilter(RequestFilter())
		logger.addHandler(fileHandler)
	else:
		# Cloud Logging for prod
		creds = service_account.Credentials.from_service_account_info(LOGGER_CREDS)
		client = GcpClient(credentials=creds, project=creds.project_id)
		cloudH = CloudLoggingHandler(
			client,
			name=f"portia-backend-{dt.date.today().isoformat()}"
		)
		cloudFmt = "(%(asctime)s) %(levelname)-8s [%(name)s] uid=%(uid)s :: %(message)s"
		cloudH.setFormatter(logging.Formatter(cloudFmt))
		cloudH.addFilter(RequestFilter())
		logger.addHandler(cloudH)

	return logger

def logRequests(f):
	"""
	Decorator for logging all request info
	"""
	@wraps(f)
	def wrapper(*args, **kwargs):
		start = time.time()
		response = f(*args, **kwargs)
		duration = (time.time() - start) * 1000
		uid = getattr(request, "uid", "anon")
		logger = getLogger("request")
		logger.debug(f"{request.method} {request.path} uid={uid} took={duration:.1f}ms")
		return response

	return wrapper
