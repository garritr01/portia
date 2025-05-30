from flask import Blueprint, jsonify
from auth import requireAuth
from backend.firebase import usersCo
from logger import getLogger
import datetime as dt
from dateutil.tz import tzlocal, tzutc
from dateutil.rrule import rrule, WEEKLY, MONTHLY, MO, WE
from backend.routes.events import updateEvent
from routes.checklist import addItem
from helpers import dt2iso


users = Blueprint("users", __name__)

@users.route("/getUserSeed", methods=["GET"])
def getSeedStatus():
    uID, err = requireAuth()
    if err:
        return jsonify(*err)
    
    expert = usersCo.document(uID).get().get("seedStatus", None)
    if not expert:
        expert = seed()
    return jsonify({"seedStatus": bool(expert)}), 200

def seed():
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
            "startStamp": f"{dt2iso(CIS658start)}",
            "endStamp": f"{dt2iso(CIS658end)}T",
            "content": [
                {
                    "label": "Did Prof Kurmas confuse our class with his undergrad class today?",
                    "type": "tf",
                    "content": True,
                }, {
                    "label": "What did you get from McDonald afterwards?",
                    "type": "input",
                    "content": "Fries"
                }, {
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
            "path": ["tutorial", "school", "Spring2025", "CIS658"],
            "recurrence": { 
                "_id": "", 
                "updated": True,
                "rule": CIS658rule,
                "span": 180*60000,
                "allCompleteBefore": CIS658allCompBefore,
                "completedSince": [],
            },
            "form": { "_id": "", "updated": True },
        },
    ]

    status1 = updateEvent(uID, seedEvents)

    item1 = {'Label': 'Laundry', 'Details': 'Probably gonna run out of underwear before Saturday', 'complete': False}
    item2 = {'Label': 'Empty Dishwasher', 'Details': 'Gettin stinky', 'complete': True}
    _, status2 = addItem(item1)
    _, status3 = addItem(item2)
    status = 201 if max([status1, status2, status3]) < 210 else 500
    if status == 201:
        usersCo.document(uID).set({"seedStatus": True}, merge=True)
    return status, status
