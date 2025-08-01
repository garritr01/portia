// helpers/HandleComposite.js

export const makeEmptyForm = () =>  ({
	_id: null, // Carry _id if already exists
	path: '', // For display and maybe filesystem use later
	info: [], // Event info minus content
	includeStart: false, // Initialize form w/ or w/o startTime - (no startTime just sets to endTime)
});
export const makeEmptyEvent = () =>  ({
	_id: null,
	formID: null, // Stores initial form used to create event form, updates based on new state of form
	scheduleID: null, // Stores the recurID
	path: '',
	scheduleStart: null, // Store the schedule instance's timestamp (for omitting schedule on calendar)
	info: [],
	complete: false,
	startStamp: new Date(), // Define start time of event
	endStamp: new Date(),
});
export const makeEmptySchedule = (newPath = '') => ({
	_id: null,
	path: newPath,
	formID: null, // Form to access for recording
	startStamp: new Date(),
	endStamp: new Date(), // Use date here, but store as endStamp in ms
	period: null, // null (no schedule)/single/daily/weekly/monthly/yearly
	interval: 1, // Every other day/week etc...
	until: new Date(),
	tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", // Timezone to base recurrence on
});
export const initialCompositeState = {
	form: makeEmptyForm(),
	event: makeEmptyEvent(),
	schedules: [],
	dirty: { form: false, event: false, schedules: {} },
	errors: { form: {}, event: {}, schedules: {} },
};

// Recursive composite update helper
const setNested = (obj, path, value) => {
	if (path.length === 0) return value;
	const [head, ...tail] = path;

	if (typeof head === 'number') {
		const arr = Array.isArray(obj) ? obj : [];
		return [
			...arr.slice(0, head),
			setNested(arr[head], tail, value),
			...arr.slice(head + 1),
		];
	}

	return {
		...(obj || {}),
		[head]: setNested((obj || {})[head], tail, value),
	};
}

// Reducer for updating composite (event, form, schedules) state
// action = { 
// 	type: 'drill' -> update with keypath + dirty, 'update' -> full update + dirty, 'set' -> full update w/o dirtying 
// }
export const updateComposite = (state, action) => {
	if (action.type === 'reset') {
		return initialCompositeState;
	} else if (action.type === 'updateDirty') {
		return {
			...state,
			dirty: setNested(state.dirty, action.path, action.value),
		}
	} else if (action.type === 'drill') {
		const [objType, ...rest] = action.path;
		if (objType === 'schedules') {
			const [idx, ...schedRest] = rest;
			const key = state.schedules[idx]?._id ?? `new_${idx}`
			return {
				...state,
				[objType]: setNested(state.schedules, rest, action.value),
				dirty: {
					...state.dirty,
					// Dirty if already dirty or the edited index
					[objType]: {
						...state.dirty.schedules,
						[key]: true
					}
				},
			};
		} else {
			return {
				...state,
				[objType]: setNested(state[objType], rest, action.value),
				dirty: {
					...state.dirty,
					[objType]: true,
				},
			};
		}
	} else {
		return {
			form: action.form ? { ...state.form, ...action.form } : state.form,
			event: action.event ? { ...state.event, ...action.event } : state.event,
			schedules: action.schedules ? action.schedules : state.schedules,
			errors: action.errors ? action.errors : state.errors,
			dirty: action.type === 'set' ?
				{
					form: false,
					event: true,
					schedules: action.schedules.reduce((acc, sched) => {
						acc[sched._id] = false;
						return acc;
					}, {})
				}
				:	{
					form: state.dirty.form || Boolean(action.form), // Dirty if already dirty, otherwise check for corresponding action
					event: state.dirty.event || Boolean(action.event),
					schedules: action.schedules ? 
						(() => {
							const newDirty = { ...state.dirty.schedules };
							action.schedules.forEach((s, idx) => {
								const key = s._id ?? `new_${idx}`;
								newDirty[key] = newDirty[key] || s._id === null // Keep previous or make true if no _id
							});
							state.schedules.forEach((s, idx) => {
								const key = s._id ?? `new_${idx}`;
								if (!action.schedules.some((s, i) => (s._id ?? `new_${i}`) === key)) { newDirty[key] = true } // Set dirty to true if removed
							})
							return newDirty;
						})() : { ...state.dirty.schedules }
				},
		}
	}
}
