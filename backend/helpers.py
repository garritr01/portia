from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Union, Iterable

tsKeys = ("startStamp", "endStamp", "until", "scheduleStart")

def _to_dt(v: Any) -> Any:
	"""ISO '...Z' or datetime -> timezone-aware datetime (UTC). Others pass through."""
	if v is None:
		return None
	if isinstance(v, datetime):
		return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
	if isinstance(v, str):
		try:
			# accept 'Z' suffix or offset
			return datetime.fromisoformat(v.replace("Z", "+00:00")).astimezone(timezone.utc)
		except ValueError:
			return v  # leave as-is if not parseable
	return v

def _to_iso_z(dt: Any) -> Any:
	"""datetime -> ISO string with 'Z'. Others pass through."""
	if not isinstance(dt, datetime):
		return dt
	if dt.tzinfo is None:
		dt = dt.replace(tzinfo=timezone.utc)
	return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

def _convert_dict_to_timestamp(d: Dict[str, Any]) -> Dict[str, Any]:
	out = dict(d)
	for k in tsKeys:
		if k in out and out[k] is not None:
			out[k] = _to_dt(out[k])
	return out

def _convert_dict_to_iso(d: Dict[str, Any]) -> Dict[str, Any]:
	out = dict(d)
	for k in tsKeys:
		if k in out and out[k] is not None:
			out[k] = _to_iso_z(out[k])
	return out

def _convertStamps2TimeStamp(objs: Union[Dict[str, Any], List[Dict[str, Any]]]):
	"""
	Convert tsKeys in obj(s) to timezone-aware datetimes (UTC).
	Accepts a single dict or a list of dicts and returns the same shape.
	"""
	if isinstance(objs, list):
		return [_convert_dict_to_timestamp(o) for o in objs]
	elif isinstance(objs, dict):
		return _convert_dict_to_timestamp(objs)
	else:
		return objs  # pass through unsupported shapes

def _convertStamps2ISOString(objs: Union[Dict[str, Any], List[Dict[str, Any]]]):
	"""
	Convert tsKeys in obj(s) to ISO 8601 '...Z' strings.
	Accepts a single dict or a list of dicts and returns the same shape.
	"""
	if isinstance(objs, list):
		return [_convert_dict_to_iso(o) for o in objs]
	elif isinstance(objs, dict):
		return _convert_dict_to_iso(objs)
	else:
		return objs  # pass through unsupported shapes
