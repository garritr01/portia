# Usage Notes
## Bugs
- Fix whatever is breaking weekly scheduling
- Guard against invalid values in time entry (going to next tries to calculate a date and can't)
	- Include an invalidFlash
## UX Improvements
- Delineate between scheduled events and recorded events
- Color scheme by leading directory
- Add suggestions for inputs
- Add autofilling with some key for path
- Add default option definition for events in form creation
- Daily could include shortcut for no weekends or weekly could include shortcut for multiple days of the week
- Note until date in preview and allow for inf recur
- Allow a 'none' for end date such that it appears on calendar (like clocking in)
- Calendar view event display indent can only reset to 0, allow to reset to lesser indent.
- Calendar view event length display doesn't quite seem to be the right height.
