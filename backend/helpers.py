# helpers.py
import datetime as dt

def dt2iso(datetime):
	"""
	datetime -> isostring. Assumes UTC, but warns if not.
	"""
	if datetime.tzinfo != dt.timezone.utc:
		if datetime.tzinfo is None:
			logger.warning(f"non-UTC timezone detected: {dt.tzinfo} Assuming UTC.")
		return datetime.isoformat(timespec="milliseconds").replace("+00:00", "Z")
	else:
		dtUTC = datetime.astimezone(dt.timezone.utc)
	
	return dtUTC.isoformat(timespec="milliseconds").replace("+00:00", "Z")

def iso2dt(iso):
	"""
	isostring -> datetime. Assumes UTC, but warns if not.
	"""
	# Convert iso tz notation to datetime
	isUTC = iso.endswith("Z")  
	hasTZ = "+" in iso[10:] or "-" in iso[:10]
	
	if iso.endswith("Z"):
		iso = iso[:-1] + "+00:00"

	datetime = dt.fromisoformat(iso)
	if isUTC:
		return datetime.astimezone(dt.timezone.utc)
	else:
		if hasTZ:
			logger.warning(f"non-UTC timezone detected: {datetime.tzinfo} Stripped to naive.")
			datetime.replace(tzInfo=None)
		return datetime

def docAndID(ref):
	doc = ref.get()
	if not doc.exists:
		return None
	return {**doc.to_dict(), '_id': doc.id}
