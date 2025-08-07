# Usage Notes
## Bugs
- Updated schedules don't remove the old instance until reload or selectedDateChange
## UX Improvements
- Add user settings, start with custom color scheme for calendar
- Add hover to show info about certain buttons
- Add move field to form
- Make width of events/recurs adjust with screen
- Fix width of dayContent (scrollbar causing issues)
- New event inherits from most recently recorded event's endtime?
- Autofill '/' on path selection when not equal to a raw path already
## Features
- Add deletes (utilize filesystem for large deletes and composite menu for small deletes)
- Add filesystem
- Add other views
## Streamlining
- Clean up css
- Clean up js
	- Drop .getTime() in >= and <= cases (they actually compare value)
