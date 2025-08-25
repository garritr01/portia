# Usage Notes
## Bugs
- Updated schedules don't remove the old instance until reload or selectedDateChange
- USE A CONSISTENT METHOD FOR THE MF TIMEZONES
	- Local events before Aug 19, 2025 are mostly incorrectly timed 
## UX Improvements
- Update indenting so lines don't overlap values (might be nice to keep it seems to indicate fucked up logging?)
- Add user settings, start with custom color scheme for calendar
- Add hover to show info about certain buttons
- Add move field to form
- Make width of events/recurs adjust with screen
- Fix width of dayContent (scrollbar causing issues)
- New event inherits from most recently recorded event's endtime?
- Autofill '/' on path selection when not equal to a raw path already (maybe just use the path that matches the most consecutive if no current level matches)
- Maintain keyNav without opening dropdown (fix double focusing)
- Add time fields to form and event objs
## Features
- Add deletes (utilize filesystem for large deletes and composite menu for small deletes)
- Add filesystem
- Add other views
- ID fields so I don't have to filter by a changeable label (for analysis)
## Streamlining
- Clean up css
- Clean up js
	- Drop .getTime() in >= and <= cases (they actually compare value)
