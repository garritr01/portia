# Usage Notes
## Bugs
- Updated schedules don't remove the old instance until reload of days
## UX Improvements
- Add user settings, start with custom color scheme for calendar
- Daily could include shortcut for no weekends or weekly could include shortcut for multiple days of the week
- Add hover to show info about certain buttons
- Add move field to form
- Make width of events/recurs adjust with screen
## Features
- Add deletes (utilize filesystem for large deletes and composite menu for small deletes)
- Add filesystem
- Add other views
## Streamlining
- Clean up css
- Clean up js
	- Drop .getTime() in >= and <= cases (they actually compare value)
