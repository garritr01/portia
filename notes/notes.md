- Windsurf
- ChatCN
- Predefine forms

# App Requirements V1

**Frontend:** React + raw CSS  
**Backend:** Python (e.g. Flask or FastAPI)  
**Database:** Firestore  

## 1. Authentication & Session Management  
- Users sign up / log in via Firebase Auth.  
- Client holds session (Firebase SDK).  
- Firestore Security Rules ensure each user can only read/write their own data.

## 2. Google Calendar Integration  
- On first sign‑up, prompt for Google OAuth consent.  
- If consented, on create/update/delete of an event, call the Google Calendar API to mirror that change.  
- Provide a user setting to enable/disable calendar sync at any time.

## 3. Event Scheduling & Completion  
1. **Create / Edit Events**  
   - Fields: title, description, end time (required), start time (optional).  
   - Recurrence options: none, daily, weekly, monthly, yearly, or custom interval.  
2. **Mark Complete**  
   - User can toggle “complete” status on each event.  
   - Completed events are visually distinguished in the calendar view and list view.  
3. **Views**  
   - **Calendar view:** day‑by‑day chronologically ordered slots.  
   - **List view:** chronological list of upcoming / past events.

## 4. Event‑Specific Custom Forms  
- Each event can have its own form schema, defined at event creation or later.  
- **Form element types:**  
  - Short text input  
  - Long text area  
  - Multiple choice (single or multi‑select)  
  - Boolean (true/false)  
  - _(Extendable for future types)_  
- **Form constraints:**  
  - Must include an “end time” field; “start time” optional.  
- **Storage hierarchy:**  


## Calendar Views

### 1. Year View
- 12 month grid (3x4).
- Each cell labeled with Month.
- Display major events as small icons/dots.
- Click month cell to open Month View.
- Arrow buttons to move year back/forward.

### 2. Month View
- 5–6 week grid (7 columns for Sun–Sat).
- Each day cell shows:
  - Day number
  - Small list of events (limit 2–3 displayed, +N more if overflowing).
- Click day cell to open Daily View.
- Arrow buttons to move month back/forward.

### 3. Daily View (Default)
- 5–7 day horizontal scroll (today centered).
- Each cell:
  - Stacked vertical events.
  - Bars represent start/end times.
  - Events without start time placed at bottom.
- Visual indicators:
  - Completed events = faded and checked.
  - Upcoming = normal.
  - Overdue = highlighted.
- Click event to complete/view form.
- Arrow/scroll navigation day-by-day.

### UX Flow
- Single-page app structure.
- Zoom into/out of views with transitions.
- Only use modals for event editing, settings, checklist.
- Keep the main timeline uncluttered and readable.


# Artifacts
- [Diagram](https://drive.google.com/file/d/1Fq8VMHb_S39oOx7wpg56WhBcC4On0Lif/view?usp=drive_link)

# To Rememeber in frontend
- Reference tutorSeed.py for structure
	- "recurrence" and "form" contain "updated" field (bool)
  - 'info' contains 'type', 'label', 'content'
    - Define 'mc', 'text', 'input' and 'tf' for now
      - 'mc' also contains options list when update needed.
  - "form" is bool, check on frontend for changes outside content, (unless new suggestion in "input")
  - autofill effective recurrence start with current time or entered time
  - Make sure start and end are exactly equal isostrings when storing
  - Daily, weekly, monthly, custom (# days), and annual recurrence, allow specific (list) as well
  - RRULE
    - YEARLY, MONTHLY, WEEKLY, DAILY, HOURLY, MIN, SEC if desired I guess
    - dtstart
    - interval
    - count or until
    - by...
      - byweekday
      - bymonthday
      - bymonth
      - bysetpos (every 3rd wednesday)
  - Checklist items are dicts

# Thoughts if still awake
- Give admin access to logs, might check off API and admin permissions simultaneously.
- Link BigQuery API

# Distant Future Thoughts
- Easy to share common/popular UI structures

# ChatGPT Lines to put back

```python
#auth.py -> checkAuth()
token = h.split(" ",1)[1] if h.startswith("Bearer ") else request.json.get("id_token")
```
