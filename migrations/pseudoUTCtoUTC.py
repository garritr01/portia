# pseudoUTCtoUTC.py
import os
import logging
from datetime import datetime, timezone, timedelta
from ensureApp import ensure_app
from helpers import _makeLogger
from firebase_admin import firestore
from zoneinfo import ZoneInfo
from google.cloud import firestore as gcf  # DELETE_FIELD sentinel

logger = _makeLogger(__file__, True)
BATCH_LIMIT = 400
TZ_NY = ZoneInfo("America/New_York")
TS_KEYS = {
	"events": ["startStamp", "endStamp", "scheduleStart"],
	"schedules": ["startStamp", "endStamp", "until"],
}

def convertEDTasUTC_toTrueUTC(d):

	tz = d.tzinfo
	if tz is None:
		logger.warning("Encountered naive datetime???")
	elif d.utcoffset() != timedelta(0):
		logger.warning(f"Encountered {tz} datetime???")
	
	naive = datetime(d.year, d.month, d.day, d.hour, d.minute, 0, 0)
	local = naive.replace(tzinfo=TZ_NY)
	
	return local.astimezone(timezone.utc)

def migrateCollection(db, name, applyLevel):
	q = db.collection(name)
	docs = list(q.stream())

	tsKeys = TS_KEYS[name]
	logger.info(f"Migrating {name} pseudoUTC (New York) to true UTC with keys [{', '.join(tsKeys)}]")

	# Counters (per doc)
	checks = skips = origCreates = origDrops = valMutates = newCreates = newDrops = 0
	while checks < len(docs): # Iterate through chunks until all have been checked
		chunk = docs[checks:checks+BATCH_LIMIT] # Grab chunk
		checks += len(chunk)
		batch = db.batch() if applyLevel > 0 else None

		for snap in chunk:
			data = snap.to_dict() or {}
			docInfoStr = f"{data.get('_id', 'no _id')} (path = {data.get('path', 'empty path')})"
			logger.debug(f"Migrating doc {docInfoStr} in {name} collection")
			updated = {}

			checked = skipped = True
			origCreated = origDropped = valMutated = newCreated = newDropped = False
			for k in tsKeys:
				if k in data:
					origVal = data[k]

					# Log wrong type warning if !(null or datetime)
					if not isinstance(origVal, datetime):
						if origVal:
							logger.warning(f"Found unexpected {type(origVal)} in {docInfoStr} key {k}")
						continue
					
					try:
						newVal = convertEDTasUTC_toTrueUTC(origVal)
						logger.debug(f"Converted {origVal.isoformat()}\n\t\tto: {newVal.isoformat()}")

						if applyLevel == 0:
							skipped = False
							continue
						elif applyLevel == 1: # Store new, no mutate
							skipped = False
							updated[f"{k}_new"] = newVal
							newCreated = True
						elif applyLevel == 2: # Store new and original, mutate
							if f"{k}_new" in data:
								updated[f"{k}_orig"] = origVal
								origCreated = True
								updated[k] = newVal
								valMutated = True
								skipped = False
							else:
								logger.warning(f"Missing {k}_new in {docInfoStr} key {k}, skipping")
						elif applyLevel == 3: # Revert back to _orig
							if f"{k}_orig" in data:
								updated[k] = data[f"{k}_orig"]
								valMutated = True
								skipped = False
							else:
								logger.warning(f"Missing {k}_orig in {docInfoStr} key {k}, skipping")
						elif applyLevel == 4: # Drop _orig and _new
							if f"{k}_orig" in data and f"{k}_new" in data:
								updated["{k}_new"] = gcf.DELETE_FIELD
								newDropped = True
								updated["{k}_orig"] = gcf.DELETE_FIELD
								origDropped = True
								skipped = False
							else:
								logger.warning(f"Missing {k}_new or {k}_orig in {docInfoStr} key {k}, skipping.")

					except Exception as e:
						skip = True
						logger.warning(f"Skipping {docInfoStr} key {k} due to: {e}")
						continue

				else:
					logger.warning(f"Missing key {k} in {docInfoStr}, skipping.")

			if not skipped and applyLevel > 0:
				payload = { **data, **updated }
				batch.set(snap.reference, payload, merge=True)

			# Count if anything was done
			if skipped:      skips += 1
			if origCreated:  origCreates += 1
			if origDropped:  origDrops += 1
			if valMutated:   valMutates += 1
			if newCreated:   newCreates += 1
			if newDropped:   newDrops += 1
					
		if applyLevel > 0:
			batch.commit()
			logger.info(f"Committed docs {checks-BATCH_LIMIT} - {checks}")

	logger.info(
		f"Alterations in {name} (# of docs/total) "
		f"Checked {checks}/{len(docs)} "
		f"Skipped {skips}/{len(docs)} "
		f"_new Created {newCreates}/{len(docs)} "
		f"_orig Created {origCreates}/{len(docs)} "
		f"Vals Mutated {valMutates}/{len(docs)} "
		f"_new Dropped {newDrops}/{len(docs)} "
		f"_orig Dropped {origDrops}/{len(docs)} "
	)

def run(mode):
	ensure_app()
	db = firestore.client()
	for colName in ["schedules", "events"]:
		migrateCollection(db, colName, mode)

if __name__ == "__main__":
	mode = int(os.getenv("APPLY", "0"))
	run(mode)