# Por.tia

## Startup
- Frontend
  - For dev ```bash nvm use node```
  - For dev ```bash npm start```
- Backend
  - For dev ```bash devSecrets.sh```
  - For prod ```bash deploySecrets.sh```

# Notes
```js
const makeEmptyForm = () =>  ({
	_id: null, // Carry _id if already exists
	path: '', // For display and maybe filesystem use later
	info: [], // Event info minus content
	includeStart: false, // Initialize form w/ or w/o startTime - (no startTime just sets to endTime)
});
const makeEmptyEvent = () =>  ({
	_id: null,
	formID: null, // Stores initial form used to create event form, updates based on new state of form
	recurID: null, // Stores the recurID
	path: '',
	recurStart: null, // Store the rRule instance's timestamp
	info: [],
	startStamp: new Date(), // Define start time of event
	endStamp: new Date(),
});
const makeEmptySchedule = () => ({
	_id: null,
	path: '',
	formID: null, // Form to access for recording
	startStamp: new Date(),
	endStamp: new Date(), // Use date here, but store as endStamp in ms
	period: null, // null (no schedule)/single/daily/weekly/monthly/yearly
	interval: 1, // Every other day/week etc...
	startRangeStamp: new Date(), // Range to repeat within
	endRangeStamp: new Date(),
	tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", // Timezone to base recurrence on
});
```
