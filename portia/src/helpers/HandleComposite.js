// helpers/HandleComposite.js

import { assignKeys } from './Misc';

export const makeEmptyForm = () =>  ({
	_id: null, // Carry _id if already exists
	path: '', // For display and maybe filesystem use later
	info: [], // Event info minus content
	includeStart: false, // Initialize form w/ or w/o startTime - (no startTime just sets to endTime)
});
export const makeEmptyEvent = () =>  ({
	_id: null,
	scheduleID: null, // Stores the recur scheduleID
	completionID: null, // Stores the completionID (handling completion of scheduled event)
	path: '',
	info: [],
	complete: 'pending',
	startStamp: new Date(), // Define start time of event
	endStamp: new Date(),
});
export const makeEmptySchedule = () => ({
	_id: null,
	path: '',
	startStamp: new Date(),
	endStamp: new Date(), // Use date here, but store as endStamp in ms
	period: null, // null (no schedule)/single/daily/weekly/monthly/yearly
	interval: 1, // Every other day/week etc...
	until: null,
	tz: null, // Timezone to base recurrence on
});
export const makeEmptyCompletion = () => ({
	_id: null,
	path: '',
	scheduleID: null,
	eventID: null,
	startStamp: null,
	endStamp: null,
	tz: null,
});
export const initialCompositeState = {
	form: makeEmptyForm(),
	event: makeEmptyEvent(),
	schedules: {},
	completion: makeEmptyCompletion(),
	dirty: { form: false, event: false, completion: false, schedules: {} },
	errors: { form: {}, event: {}, schedules: {} },
	toDelete: { form: false, event: false, completion: false, schedules: {} }
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
};

// Build object full of falses mirroring passed in object at top level
const buildFalseObj = (obj) => Object.keys(obj || {}).reduce((acc, k) => { 
	acc[k] = false;
	return acc;
}, {});

// Update 'dirty' (true if was true or key in action)
const mergeSchedulesDirty = (prevFlags = {}, action = {}) => Object.fromEntries(
	Object.keys({ ...prevFlags, ...action }).map(k => 
		[k, Boolean(prevFlags[k]) || k in action]
	)
);

/**
 * updateComposite reducer
 *
 * Action shapes:
 * - General: action.form | action.event | action.schedules (object of schedules keyed by id/new_key)
 * - drill:   { type: 'drill', path: ['form'|'event'|'schedules', ...], value, dirty? }
 * - delete:  { type: 'delete', path: ['form'|'event'|'schedules', key?], delete? }
 * - set:     { type: 'set', form?, event?, schedules?, errors? }
 *
 * Behavior:
 *  reset
 *    - Resets to a brand-new empty composite (dirty/toDelete cleared).
 *
 *  drill
 *    - Updates a nested path.
 *    - If path starts with 'schedules', marks that schedule key dirty.
 *    - Pass action.dirty === false to override and keep it not-dirty.
 *    - For form/event, marks the whole object dirty unless action.dirty === false.
 *
 *  delete
 *    - Flags for deletion (does NOT remove from state).
 *    - For schedules: sets toDelete.schedules[key] = true (or false if action.delete === false).
 *    - For form/event: sets toDelete.form|event = true (or false to undo).
 *
 *  set
 *    - Replaces provided objects and fully cleans flags for those objects.
 *    - dirty.* reset to false; toDelete.* reset to false for provided objects.
 *    - For schedules: toDelete.schedules and dirty.schedules are rebuilt with all-false for the new keys.
 *
 *  default
 *    - Merges any provided form/event/schedules/errors into state.
 *    - Marks dirty.form / dirty.event if those objects were included.
 *    - For schedules, expects action.schedules to be a DELTA (only changed/new keys);
 *      only those keys are marked dirty (existing true flags are preserved).
 *      If you pass the full map and want automatic diffing, replace mergeSchedulesDirty
 *      with a diff-based helper.
 */
export const updateComposite = (state, action) => {
	switch (action.type) {

		case "reset":
			return initialCompositeState;

		case "delete":
			const [delObjType, ...deleteRest] = action.path;

			if (delObjType === 'schedules') {
				const key = deleteRest[0];
				return {
					...state,
					toDelete: {
						...state.toDelete,
						schedules: {
							...state.toDelete.schedules,
							[key]: action?.delete === false ? false : true
						}
					}
				};
			}

			return {
				...state,
				toDelete: {
					...state.toDelete,
					[delObjType]: action?.delete === false ? false : true,
					...((delObjType === 'event') ? { completion: action?.delete === false ? false : true } : {})
				}
			};

		case "drill":
			const [drillObjType, ...drillRest] = action.path;

			if (drillObjType === 'schedules') {

				const key = drillRest[0];
				return {
					...state,
					schedules: setNested(state.schedules, drillRest, action.value),
					dirty: {
						...state.dirty,
						// Dirty if already dirty or the edited index
						schedules: {
							...state.dirty.schedules,
							[key]: action?.dirty === false ? false : true
						}
					},
					toDelete: {
						...state.toDelete,
						schedules: {
							...state.toDelete.schedules,
							[key]: state.toDelete.schedules?.[key] === undefined ? false : state.toDelete.schedules?.[key]
						}
					}
				};

			}

			return {
				...state,
				[drillObjType]: setNested(state[drillObjType], drillRest, action.value),
				dirty: {
					...state.dirty,
					[drillObjType]: action?.dirty === false ? false : true,
				},
			}
	
		case "set":
			const setForm = action.form ?? state.form;
			const setEvent = action.event ?? state.event;
			const setCompletion = action.completion ?? state.completion;
			const setSchedules = action.schedules ?? state.schedules;
			const setErrors = action.errors ?? state.errors;

			return {
				form: setForm,
				event: setEvent,
				completion: setCompletion,
				schedules: setSchedules,
				errors: setErrors,
				toDelete: {
					form: action.form ? false : state.toDelete.form,
					event: action.event ? false : state.toDelete.event,
					completion: action.completion ? false : state.toDelete.completion,
					schedules: action.schedules ? buildFalseObj(setSchedules) : state.toDelete.schedules,
				},
				dirty: {
					form: false,
					event: false,
					completion: action?.dirtyComplete ?? false,
					schedules: action.schedules ? buildFalseObj(setSchedules) : state.dirty.schedules,
				}
			};

		default:

			const defForm = action.form ?? state.form;
			const defEvent = action.event ?? state.event;
			const defCompletion = action.completion ?? state.completion;
			const defSchedules = action.schedules ?? state.schedules;
			const defErrors = action.errors ?? state.errors;

			return {
				form: defForm,
				event: defEvent,
				completion: defCompletion,
				schedules: defSchedules,
				errors: defErrors,
				toDelete: state.toDelete,
				dirty: {
					form: state.dirty.form || Boolean(action.form),
					event: state.dirty.event || Boolean(action.event),
					completion: state.dirty.completion || Boolean(action.completion),
					schedules: mergeSchedulesDirty(state.dirty.schedules, action.schedules),
				},
			}
	}
};

// Initialize empty form for event, form, sched
export const initEmptyComposite = (date, reduceComposite) => {
	reduceComposite({ type: 'reset' });
	const clicked = new Date(date);
	const current = new Date();
	clicked.setHours(current.getHours(), current.getMinutes(), 0, 0);
	reduceComposite({ type: 'drill', path: ['event', 'endStamp'], value: clicked });
	reduceComposite({ type: 'drill', path: ['event', 'startStamp'], value: clicked });
};

// Create composite based on event
export const createCompositeFromEvent = (event, forms, completions, schedules, reduceComposite) => {

	// Should always be found
	const newForm = forms.find(f => f.path === event.path);

	// Find completion if exists
	const newCompletion = completions.find(c => c._id === event.completionID);

	// None to many may be found
	const newSchedList = schedules.filter(s => s.path === event.path);
	const newScheds = Object.fromEntries(newSchedList.map(s => [s._id, s]));

	const newEvent = { 
		...event,
		endStamp: (event.complete === 'pending' && newForm.includeStart) ? new Date() : event.endStamp // Update endStamp to now if pending
	};

	reduceComposite({
		type: 'set',
		event: assignKeys(newEvent),
		form: assignKeys(newForm),
		completion: newCompletion,
		schedules: newScheds,
	});

};

// Create composite based on recur
export const createCompositeFromRecur = (recur, forms, schedules, reduceComposite) => {
	const { isRecur, ...recurClean } = recur;
	const { tz, _id, ...eventBasis } = recurClean;

	const newSchedList = schedules.filter(s => s.path === recur.path);
	const newScheds = Object.fromEntries(newSchedList.map(s => [s._id, s]));

	const newCompletion = {
		...recurClean,
		eventID: null,
	};

	let newForm = forms.find(f => f.path === recur.path);
	if (!newForm.includeStart && recur.startStamp.getTime() !== recur.endStamp.getTime()) {
		newForm = { ...newForm, includeStart: true }
	}

	let newEvent = { 
		...makeEmptyEvent(), 
		...eventBasis,
		completionID: _id,
		info: newForm.info.map(f => {
			const { suggestions, baseValue, placeholder, ...cleanF } = f;
			return({ 
				...cleanF,
				content: 
					f.type === 'input' ? (
						baseValue ? [baseValue] : ['']
					) 
					: f.type === 'text' ? (
						baseValue ? baseValue : ''
					) 
					: null
				});
		})
	};

	//console.log("Creating from recur, event:", assignKeys(newEvent), "\n form:", assignKeys(newForm))
	reduceComposite({ 
		type: 'set', 
		event: assignKeys(newEvent), 
		form: assignKeys(newForm), 
		completion: newCompletion,
		dirtyComplete: true,
		schedules: newScheds
	});
};
