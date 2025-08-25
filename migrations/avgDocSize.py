# pseudoUTCtoUTC.py
import os
import json
import logging
from datetime import datetime, timezone, timedelta
from ensureApp import ensure_app
from helpers import _makeLogger
from firebase_admin import firestore
from zoneinfo import ZoneInfo
from google.cloud import firestore as gcf  # DELETE_FIELD sentinel

logger = _makeLogger(__file__, True)
BATCH_LIMIT = 400

def estimateSize(obj):
	""" Returns dict size in KB """
	try:
		return len(json.dumps(obj, default=str).encode("utf-8")) / 1024
	except Exception as e:
		logger.warning(f"Failed to estimate size of {type(obj)}: {e}")
		return 0

def analyzeCollection(db, name):
	docs = list(db.collection(name).stream())

	sizes = []
	for i in range(0, len(docs), BATCH_LIMIT):
		chunk = docs[i:i+BATCH_LIMIT]
		for snap in chunk:
			size = estimateSize(snap.to_dict() or {})
			sizes.append(size)

	avg = sum(sizes) / len(sizes)

	logger.info(
		f"Collection '{name}'"
		f"\n{len(sizes)} docs"
		f"\navg: {avg:.4f} KB"
		f"\nmin={min(sizes)} KB"
		f"\nmax={max(sizes)} KB"
	)

def run():
	ensure_app()
	db = firestore.client()
	for colName in ["events", "completions", "forms", "schedules"]:
		analyzeCollection(db, colName)

if __name__ == "__main__":
	run()