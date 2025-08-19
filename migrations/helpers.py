# helpers.py

import os
import logging
from datetime import datetime, timezone

# callerFile for name
# debug (bool) DEBUG if true, otherwise INFO
def _makeLogger(callerFile, debug = False):

	logDir = os.path.join(os.path.dirname(os.path.abspath(callerFile)), "logs")
	os.makedirs(logDir, exist_ok=True)
	logName = os.path.splitext(os.path.basename(callerFile))[0] + ".log"
	logPath = os.path.join(logDir, logName)

	level = logging.DEBUG if debug else logging.INFO
	logger = logging.getLogger(os.path.splitext(os.path.basename(callerFile))[0])
	logger.setLevel(level)
	logger.propagate = False

	if not any(isinstance(h, logging.FileHandler) and getattr(h, "baseFilename", None) == logPath for h in logger.handlers):
		fh = logging.FileHandler(logPath)
		fh.setLevel(level)
		fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
		logger.addHandler(fh)
	
	return logger

def _parseISO(v):
	if v is None:
		return None
	if isinstance(v, datetime):
		return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
	if isinstance(v, str):
		try:
			return datetime.fromisoformat(v.replace("Z", "+00:00")).astimezone(timezone.utc)
		except ValueError:
			return None
	return None