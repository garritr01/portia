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
export const makeEmptyFlags = () => ({ form: false, event: false, completion: false, schedules: {} });
export const makeEmptyErrors = () => ({ form: {}, event: {}, schedules: {} });
export const makeEmptyComposite = () => ({
	form: makeEmptyForm(),
	event: makeEmptyEvent(),
	schedules: {},
	completion: makeEmptyCompletion(),
	dirty: makeEmptyFlags(),
	errors: makeEmptyErrors(),
	toDelete: makeEmptyFlags()
});

// Drill into obj with path keys and update value
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

/**
 * Create/update a flag object. At each key, if action set true, otherwise prev, otherwise default to false
 * @param {Object} shapeObj - Determines keys needed for flag object
 * @param {Object} prevFlags - Previous flags to use
 * @param {Object} actions - Actions to determine whether flag needs to be changed
 * @param {Object} overrides - Overrides passed with action
 */
const reconcileFlags = (shapeObj, prevFlags, actions, overrides) =>
	Object.keys(shapeObj || {}).reduce((acc, k) => {

		if (['dirty', 'toDelete', 'errors'].includes(k)) { return acc }
		if (k === 'schedules') { 
			acc.schedules = reconcileFlags(
				shapeObj?.schedules || {}, 
				prevFlags?.schedules || {}, 
				actions?.schedules || {}, 
				overrides?.schedules || {}
			);
			return acc;
		}

		// If ovverides[k], use override value
		const hasOverride = (Object.hasOwn(overrides || {}, k));
		if (hasOverride) {
			if (typeof overrides[k] !== 'boolean') { console.warn("Non-bool override flag in reconcileFlags: ", overrides, "\nWhile creating for shape: ", shapeObj) }
			acc[k] = overrides[k];
			return acc;
		}

		// If action[k], flag true
		const hasAction = (Object.hasOwn(actions || {}, k));
		if (hasAction) {
			acc[k] = true;
			return acc;
		}
		
		// If prev[k], use prev
		const hasPrev = (Object.hasOwn(prevFlags || {}, k));
		if (hasPrev) {
			if (typeof prevFlags[k] !== 'boolean') { console.warn("Non-bool prev flag in reconcileFlags: ", prevFlags, "\nWhile creating for shape: ", shapeObj) }
			acc[k] = prevFlags[k];
			return acc;
		}

		// If neither, flag false
		acc[k] = false;
		return acc;

	}, {});

/**
 * updateComposite reducer
 *
 * Behavior(by type):
 *
 *  drill
 *    - Updates a nested path. Dirties unless { dirty: false } passed with in action.
 * 		- { type: 'drill', path: [objType, ...], value: someVal, dirty? }
 *
 *  delete
 *    - Toggles flags for deletion on upsert (does NOT remove from state).
 * 		- { type: 'delete', path: [objType, scheduleKey?], delete? }
 * 
 *  set
 *    - Bulk update objects. Fallback to state. Allow a mirrored structured dirty and toDelete for manual setting.
 * 		- { type: 'set', form?, event?, completion?, schedules?, dirty?, toDelete? }
 * 
 *  reset
 *    - Bulk update objects. Fallback to empty. Allow a mirrored structured dirty and toDelete for manual setting.
 * 		- { type: 'reset', form?, event?, completion?, schedules?, dirty?, toDelete? }
 */
export const updateComposite = (state, action) => {
	const { type, ...actionRest } = action;

	switch (type) {

		case "delete":

			// Separate leading key in path (objType) from rest of path
			const [delObjType, ...deleteRest] = action.path;

			if (delObjType === 'schedules' && deleteRest.length !== 1) { console.warn("Invalid attempt to mark schedule for deletion. path: ", action.path) }
			if (delObjType !== 'schedules' && deleteRest.length !== 0) { console.warn(`Invalid attempt to delete ${delObjType}. path: `, action.path) }

			if (delObjType === 'schedules') {
				const key = deleteRest[0]; // Get schedule key (_id)

				return {
					...state, // Retain rest of state
					toDelete: {
						...state.toDelete, // Retain rest of toDelete state
						schedules: {
							...state.toDelete.schedules, // Retain rest of toDelete.schedule state
							[key]: action?.delete === false ? false : true // Toggle toDelete.schedule.key
						}
					}
				};
			}

			return {
				...state,  // Retain rest of state
				toDelete: {
					...state.toDelete, // Retain rest of toDelete state
					[delObjType]: action?.delete === false ? false : true, // Toggle toDelete[objType]
					...((delObjType === 'event') ? { completion: action?.delete === false ? false : true } : {}) // Sync completion deletion with event
				}
			};

		case "drill":
			// Separate leading key in path (objType) from rest of path
			const [drillObjType, ...drillRest] = action.path;

			if (drillObjType === 'schedules') {
				const key = drillRest[0]; // Get schedule key (_id)

				return {
					...state, // Retain rest of state
					schedules: setNested(state.schedules, drillRest, action.value), // Drill into path and update
					dirty: {
						...state.dirty, // Retain rest of dirty state
						schedules: {
							...state.dirty.schedules, // Retain rest of dirty.schedules state
							[key]: action?.dirty === false ? false : true // Toggle dirty.schedules.key
						}
					},
					toDelete: { // Create a toDelete state for new schedule
						...state.toDelete, // Retain rest of toDelete state
						schedules: {
							...state.toDelete.schedules, // Retain rest of toDelete.schedules state
							[key]: state.toDelete.schedules?.[key] ?? false // Use prev toDelete.schedules.key state unless absent, then initialize as false
						}
					}
				};

			}

			return {
				...state, // Retain rest of state
				[drillObjType]: setNested(state[drillObjType], drillRest, action.value), // Drill into path and update
				dirty: {
					...state.dirty, // Retain rest of dirty state
					[drillObjType]: action?.dirty === false ? false : true, // Mark dirty unless dirty flag passed as false
				}
			}
	
		case "set":
			const setNext = { ...state, ...actionRest };
			setNext.dirty = reconcileFlags(setNext, { ...(state.dirty || {}), ...(action.dirty || {}) }, actionRest, (action.dirty || {}));
			setNext.toDelete = reconcileFlags(setNext, { ...(state.toDelete || {}), ...(action.toDelete || {}) }, {}, (action.toDelete || {}));
			return setNext;

		case "reset":
			const resetNext = { ...makeEmptyComposite(), ...actionRest };
			resetNext.dirty = reconcileFlags(resetNext, (action.dirty || {}), {}, {});
			resetNext.toDelete = reconcileFlags(resetNext, (action.toDelete || {}), {}, {});
			return resetNext;
		
		default:
			console.warn(`Invalid updateComposite action type: '${type}'`);
			return state;
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

// Find form with path
const findForm = (path, forms, formIDsByPath) => {
	const newFormID = formIDsByPath[path];
	const newForm = !newFormID ? undefined : forms?.[newFormID];
	if (!newForm) { 
		console.warn(`No form found with path: '${path}' and derived ID: '${newFormID}'`) 
		return makeEmptyForm();
	}
	return newForm ?? makeEmptyForm();
};

// Find schedules with path
const findSchedules = (path, schedules, scheduleIDsByPath) => {
	console.log("ScheduleIDsByPath", scheduleIDsByPath);
	const newSchedIDs = scheduleIDsByPath?.[path];
	if (!newSchedIDs) { return {} }
	const newScheds = Object.fromEntries(
		newSchedIDs.map(_id => {
			const newSched = schedules?.[_id] ?? {};
			if (!newSched) { console.warn(`No schedule found with _id ${_id}`)}
			return [_id, newSched];
		})
	);
	return newScheds || {};
};

// Find completion with _id
const findCompletion = (compID, completions) => {
	const newCompletion = completions?.[compID];
	if (compID && !newCompletion) { console.warn(`Completion not found with _id: ${compID}.`)}
	return newCompletion || makeEmptyCompletion();
};

// Autofill event info using form info
export const autofillEventInfo = (info) => {
	return (info ?? []).map(f => {
		const { suggestions, baseValue, placeholder, ...cleanF } = f;
		return ({
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
}

// Create composite based on event
export const createCompositeFromEvent = (event, forms, completions, schedules, formIDsByPath, scheduleIDsByPath, reduceComposite) => {
	console.log("Creating composite from event.");

	// Should always be found
	const newForm = findForm(event.path, forms, formIDsByPath);

	// Find completion if exists
	const newCompletion = findCompletion(event.completionID, completions);

	// None to many may be found
	const newScheds = findSchedules(event.path, schedules, scheduleIDsByPath);

	// Autofill endStamp with current time for pending event
	const newEvent = { 
		...event,
		endStamp: (event.complete === 'pending' && newForm.includeStart) ? new Date() : event.endStamp
	};

	reduceComposite({
		type: 'reset',
		event: assignKeys(newEvent),
		form: assignKeys(newForm),
		completion: newCompletion,
		schedules: newScheds,
	});

};

// Create composite based on recur
export const createCompositeFromRecur = (recur, forms, schedules, formIDsByPath, scheduleIDsByPath, reduceComposite) => {
	console.log("Creating composite from recur.");

	const { isRecur, ...recurClean } = recur;
	const { tz, _id, ...eventBasis } = recurClean;

	// Toggle includeStart to true if recur startStamp and endStamp are different times 
	const newForm = {
		...findForm(recur.path, forms, formIDsByPath),
		...((recur.startStamp.getTime() !== recur.endStamp.getTime()) ? { includeStart: true } : {})
	};

	const newScheds = findSchedules(recur.path, schedules, scheduleIDsByPath);

	// New completion means new event, meaning null ID to be filled on event save (backend)
	const newCompletion = {
		...recurClean,
		eventID: null,
	};

	const newEvent = { 
		...makeEmptyEvent(), 
		...eventBasis,
		completionID: _id,
		info: autofillEventInfo(newForm.info)
	};

	//console.log("Creating from recur, event:", assignKeys(newEvent), "\n form:", assignKeys(newForm))
	reduceComposite({ 
		type: 'reset', 
		event: assignKeys(newEvent), 
		form: assignKeys(newForm), 
		completion: newCompletion,
		schedules: newScheds,
		dirty: { completion: true }
	});
};

// Create empty event from path load
export const createCompositeFromPath = (path, forms, schedules, formIDsByPath, scheduleIDsByPath, reduceComposite) => {

	console.log("Creating composite from path: ", path);

	const newForm = findForm(path, forms, formIDsByPath);
	const newScheds = findSchedules(path, schedules, scheduleIDsByPath);
	const newEvent = {
		...makeEmptyEvent(),
		info: autofillEventInfo(newForm?.info)
	};

	//console.log("Creating from recur, event:", assignKeys(newEvent), "\n form:", assignKeys(newForm))
	reduceComposite({ 
		type: 'reset', 
		event: assignKeys(newEvent),
		form: assignKeys(newForm),
		schedules: newScheds
	});
};

