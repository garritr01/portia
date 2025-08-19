# fromTS.py
import os
import logging
from datetime import datetime
from typing import Optional

from ensureApp import ensure_app  # adjust to `ensure_app` if your module is named ensure_app.py
from firebase_admin import firestore

# ---------- logging: file-only ----------
_logs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(_logs_dir, exist_ok=True)
_log_name = os.path.splitext(os.path.basename(__file__))[0] + ".log"
_log_path = os.path.join(_logs_dir, _log_name)

logger = logging.getLogger(os.path.splitext(os.path.basename(__file__))[0])
logger.setLevel(logging.INFO)
logger.propagate = False
if not any(isinstance(h, logging.FileHandler) and getattr(h, "baseFilename", None) == _log_path
	for h in logger.handlers):
	fh = logging.FileHandler(_log_path)
	fh.setLevel(logging.INFO)
	fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
	logger.addHandler(fh)
# ----------------------------------------

BATCH_LIMIT = 400  # keep under 500 write limit

def run(applyChanges: bool):
	"""
	Promote <key>TS -> <key> for:
		keys: startStamp, endStamp, until, scheduleStart
	Does NOT delete the *TS fields (keeps them as a safety net).
	"""
	ensure_app()
	db = firestore.client()

	owner_id = os.getenv("MIGRATE_OWNER_ID") or None
	ts_keys = ["startStamp", "endStamp", "until", "scheduleStart"]

	collections = (
		("events", db.collection("events")),
		("schedules", db.collection("schedules")),
	)

	for name, col in collections:
		q = col.where("ownerID", "==", owner_id) if owner_id else col
		docs = list(q.stream())
		num_docs = len(docs)
		logger.info(f"[toTS] {name}: total_docs={num_docs} mode={'APPLY' if applyChanges else 'DRY-RUN'} owner={owner_id!r}")

		touched = moved = missing_or_bad = 0
		i = 0
		while i < num_docs:
			chunk = docs[i:i + BATCH_LIMIT]
			batch = db.batch() if applyChanges else None

			for snap in chunk:
				data = snap.to_dict() or {}
				touched += 1

				out = {}
				for k in ts_keys:
					ts_field = f"{k}TS"
					if ts_field in data:
						val = data.get(ts_field)
						if isinstance(val, datetime):
							# always set canonical to the TS value
							out[k] = val
							moved += 1
						else:
							# present but not a datetime -> log and count
							missing_or_bad += 1

				if out and applyChanges:
					# set only; do NOT delete *TS
					batch.set(snap.reference, out, merge=True)

			if applyChanges:
				batch.commit()
				logger.info(f"[toTS] {name}: committed batch size={len(chunk)}")

			i += len(chunk)

		logger.info(f"[toTS] {name}: touched={touched} moved={moved} missing_or_bad_ts={missing_or_bad}")

if __name__ == "__main__":
	applyChanges = os.getenv("APPLY", "0") == "1"  # 0=dry-run, 1=apply
	run(applyChanges)
