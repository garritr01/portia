from __future__ import annotations
from datetime import datetime, timezone

tsKeys = ("startStamp", "endStamp", "until")

def _isoToDt(iso):
	if not isinstance(iso, str):
		return iso

	s = iso.strip()
	try:
		dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
		dtUTC = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
		return dtUTC
	except ValueError:
		return iso

def _dtToIso(dt):
	if not isinstance(dt, datetime):
		return dt

	dtUTC = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
	iso = dtUTC.isoformat().replace("+00:00", "Z")
	return iso

def _dictToDt(d):
	out = dict(d)
	for k in tsKeys:
		if k in out and out[k] is not None:
			out[k] = _isoToDt(out[k])
	return out

def _dictToIso(d):
	out = dict(d)
	for k in tsKeys:
		if k in out and out[k] is not None:
			out[k] = _dtToIso(out[k])
	return out

def _objsToDt(objs):
	"""
	Convert tsKeys in obj(s) to timezone-aware datetimes (UTC).
	Accepts a single dict or a list of dicts and returns the same shape.
	"""
	if isinstance(objs, list):
		return [_dictToDt(o) for o in objs]
	elif isinstance(objs, dict):
		return _dictToDt(objs)
	else:
		return objs  # pass through unsupported shapes

def _objsToIso(objs):
	"""
	Convert tsKeys in obj(s) to ISO 8601 '...Z' strings.
	Accepts a single dict or a list of dicts and returns the same shape.
	"""
	if isinstance(objs, list):
		return [_dictToIso(o) for o in objs]
	elif isinstance(objs, dict):
		return _dictToIso(objs)
	else:
		return objs  # pass through unsupported shapes
