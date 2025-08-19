# toTS.py
import os
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

from ensureApp import ensure_app  # keep your module name
from firebase_admin import firestore
from google.cloud import firestore as gcf  # DELETE_FIELD sentinel

# ---------- logging: file-only ----------
_logs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(_logs_dir, exist_ok=True)
_log_name = os.path.splitext(os.path.basename(__file__))[0] + ".log"
_log_path = os.path.join(_logs_dir, _log_name)
logger = logging.getLogger(os.path.splitext(os.path.basename(__file__))[0])
logger.setLevel(logging.INFO)
logger.propagate = False
if not any(
	isinstance(h, logging.FileHandler) and getattr(h, "baseFilename", None) == _log_path
	for h in logger.handlers
):
	fh = logging.FileHandler(_log_path)
	fh.setLevel(logging.INFO)
	fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
	logger.addHandler(fh)
# ----------------------------------------

BATCH_LIMIT = 400  # < 500

def _parse_to_dt(v) -> Optional[datetime]:
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

def run(*, apply_changes: bool, owner_id: Optional[str]) -> Tuple[int, int, int]:
	"""
	Copy <key>TS -> <key>. If <key>TS missing, try parsing <key> string.
	Also removes the corresponding *TS fields in the same write.
	Returns (touched_docs, canonical_set_count, skipped).
	"""
	ensure_app()
	db = firestore.client()

	work = [
		("events",    db.collection("events"),    ["startStamp", "endStamp", "scheduleStart"]),
		("schedules", db.collection("schedules"), ["startStamp", "endStamp", "until"]),
	]

	touched_total = set_count_total = skipped_total = 0

	for name, col, keys in work:
		q = col.where("ownerID", "==", owner_id) if owner_id else col
		snaps = list(q.stream())
		logger.info(f"[toTS] {name}: docs={len(snaps)} mode={'APPLY' if apply_changes else 'DRY-RUN'} owner={owner_id!r}")

		touched = set_count = skipped = 0

		for i in range(0, len(snaps), BATCH_LIMIT):
			chunk = snaps[i:i+BATCH_LIMIT]
			batch = db.batch() if apply_changes else None
			pending = 0

			for s in chunk:
				d = s.to_dict() or {}
				touched += 1

				# Build the canonical updates...
				out = {}
				for k in keys:
					ts_field = f"{k}TS"
					val_ts = d.get(ts_field)

					if isinstance(val_ts, datetime):
						out[k] = val_ts
						set_count += 1
					elif ts_field in d:
						# TS present but wrong type
						skipped += 1
					else:
						# No TS; try to parse canonical string (self-heal)
						v = d.get(k)
						dt = _parse_to_dt(v)
						if dt:
							out[k] = dt
							set_count += 1
						elif v is not None:
							skipped += 1

				# ...and the deletes for all *TS companions of keys we manage
				del_map = {f"{k}TS": gcf.DELETE_FIELD for k in keys if f"{k}TS" in d}

				if (out or del_map) and apply_changes:
					# Use update so DELETE_FIELD is honored
					payload = {**out, **del_map}
					batch.update(s.reference, payload)
					pending += 1

			if apply_changes and pending:
				batch.commit()
				logger.info(f"[toTS] {name}: committed batch size={pending}")

		logger.info(f"[toTS] {name}: touched={touched} canonical_set={set_count} skipped={skipped}")
		touched_total += touched
		set_count_total += set_count
		skipped_total += skipped

	return touched_total, set_count_total, skipped_total

if __name__ == "__main__":
	apply_flag = os.getenv("APPLY", "0") == "1"  # 0=dry-run, 1=apply
	owner = os.getenv("MIGRATE_OWNER_ID") or None
	t, c, s = run(apply_changes=apply_flag, owner_id=owner)
	mode = "APPLY" if apply_flag else "DRY-RUN"
	print(f"[toTS] mode={mode} owner={owner!r} touched={t} canonical_set={c} skipped={s}")

