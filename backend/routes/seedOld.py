# seed.py
from flask import Blueprint, jsonify
import datetime as dt
from dateutil.tz import tzlocal, tzutc
from dateutil.rrule import rrule, DAILY, WEEKLY, MONTHLY, YEARLY, SU, MO, TU, WE, TH, FR, SA
from run import app
from auth import requireAuth
from routes.eventPOST import updateEvent
from routes.checklist import addItem
from helpers import dt2iso, iso2dt
from logger import getLogger
from db import usersCo

logger = getLogger(__name__)

#seed = Blueprint("seed", __name__)

#@seed.route("/seed", methods=["POST"])
def seedAll():
	uID, err = requireAuth()
	if err:
		return jsonify(*err)

	# Define start and end of event, and define recurrence rules
	CIS658start = dt.datetime.combine(dt.date(2025, 1, 8), dt.time(18, 0), tzinfo=tzlocal()).astimezone(tzutc())
	CIS658end = dt.datetime.combine(dt.date(2025, 1, 8), dt.time(21, 0), tzinfo=tzlocal()).astimezone(tzutc())
	CIS658allCompBefore = dt.datetime.combine(dt.date(2025, 4, 25), dt.time(18, 0), tzinfo=tzlocal()).astimezone(tzutc())
	CIS658rule = rrule(freq=WEEKLY, dtStart=dt.date(2025, 4, 25), interval=1, byweekday=[MO]).to_ical().decode()
	
	CIS678start = dt.datetime.combine(dt.date(2025, 1, 8), dt.time(15, 0), tzinfo=tzlocal()).astimezone(tzutc())
	CIS678end = dt.datetime.combine(dt.date(2025, 1, 8), dt.time(16, 15), tzinfo=tzlocal()).astimezone(tzutc())
	CIS678allCompBefore = dt.datetime.combine(dt.date(2025, 4, 25), dt.time(15, 0), tzinfo=tzlocal()).astimezone(tzutc())
	CIS678rule = rrule(freq=WEEKLY, dtStart=dt.date(2025, 4, 25), interval=1, byweekday=[MO, WE]).to_ical().decode()

	rentStart = dt.datetime.combine(dt.today(), dt.time(23, 59), tzinfo=tzlocal()).astimezone(tzutc())
	rentEnd = dt.datetime.combine(dt.today(), dt.time(23, 59), tzinfo=tzlocal()).astimezone(tzutc())
	rentAllCompBefore = dt.datetime.combine(dt.date(2025, 4, 20), dt.time(15, 0), tzinfo=tzlocal()).astimezone(tzutc())
	rentRule = rrule(freq=MONTHLY, dtStart=dt.date(2025, 4, 20), interval=1, byweekday=[MO, WE]).to_ical().decode()

	seedEvents = [
		{
			# Event start and end timestamps
			"startStamp": f"{dt2iso(CIS658start)}",
			"endStamp": f"{dt2iso(CIS658end)}T",
			# Filled out form
			"content": [
				{
					"label": "Did Prof Kurmas confuse our class with his undergrad class today?",
					"type": "tf",
					"content": True,
				}, {
					"label": "What did you get from McDonald afterwards?",
					"type": "input",
					"content": "Fries"
				}, { # Multiple choice returns options on change
					"label": "What time did you get out?",
					"type": "mc",
					"content": "Before 8:30",
					"options": ["Before 8:00", "Before 8:30", "Before 9:00", "After 9:00"]
				}, { 
					"label": "Notes",
					"type": "text",
					"content": (
						"We talked about web security today. "
						"It seems like someone invented tokens, then everyone "
						"after decided to upgrade it by just adding another one."
					),
				},
			],
			# emulates parentDir/dir/filename
			"path": ["tutorial", "school", "Spring2025", "CIS658"],
			# New recurrence, so no ID and has changed 
			"recurrence": { 
				"_id": "", 
				"updated": True,
				"rule": CIS658rule,
				"span": 180*60000,
				"allCompleteBefore": CIS658allCompBefore,
				"completedSince": [],
			},
			# New form, so no ID and has changed
			"form": { "_id": "", "updated": True },
		}, 
		{
			"startStamp": f"{CIS678start}",
			"endStamp": f"{CIS678end}T",
			"content": [
				{ 
					"label": "Notes",
					"type": "text",
					"content": (
						"Sample notes. "
					),
				},
			],
			"path": ["tutorial", "school", "Spring2025", "CIS678"],
			"recurrence": { 
				"_id": "", 
				"updated": True,
				"rule": CIS678rule,
				"span": 75*60000,
				"allCompleteBefore": CIS678allCompBefore,
				"completedSince": [],
			},
			"form": { "_id": "", "updated": True },
		}, {
			"startStamp": f"{rentStart}",
			"endStamp": f"{rentEnd}T",
			"content": [
				{ 
					"label": "Notes",
					"type": "text",
					"content": (
						"Sample notes. "
					),
				},
			],
			"path": ["finances", "rent"],
			"recurrence": { 
				"_id": "", 
				"updated": True,
				"rule": CIS678rule,
				"span": 75*60000,
				"allCompleteBefore": CIS678allCompBefore,
				"completedSince": [],
			},
			"form": { "_id": "", "updated": True },
		},
	]

	# Initialize event related collections
	status1 = updateEvent(uID, seedEvents)

	# Define a few checklist items
	item1 = {'Label': 'Laundry', 'Details': 'Probably gonna run out of underwear before Saturday', 'complete': False}
	item2 = {'Label': 'Empty Dishwasher', 'Details': 'Gettin stinky', 'complete': True}
	_, status2 = addItem(item1)
	_, status3 = addItem(item2)
	status = 201 if max([status1, status2, status3]) < 210 else 500
	if status == 201:
		usersCo.document(uID).set({"seedStatus": True}, merge=True)
	return status, status
