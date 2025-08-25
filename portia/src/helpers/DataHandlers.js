// helpers/DataHandler.js

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUser } from '../contexts/UserContext.js';
import { useFetchEvents, useFetchCompletions, useFetchForms, useFetchSchedules } from '../requests/CalendarData.js';
import { useFetchChecklist } from '../requests/ChecklistData.js'; 
import { useSave } from '../requests/General.js';
import { defFetchRanges, dayTicksBetween, getAllRecurs, ISOsToDates, addTime } from './DateTimeCalcs';

// Based on (KB) averages in db from 8/22/25
const docSizes = {
	recurs: 0.4 / 1024, // overestimate based on schedule size
	events: 0.8 / 1024, // overestimate since events are dynamic
	completions: 0.25 / 1024, // should be accurate forever
	forms: 0.75 / 1024, // overestimate since forms are dynamic (and grow w suggestions)
	schedules: 0.5 / 1024 // should be accurate forever
};

export const useCalendarDataHandler = (startDate, endDate, localTZ, reduceComposite, timeoutLength = 300, maxMemUsage = 10, dayWindow = 32) => {
	const { user } = useUser();
	const save = useSave();

	const getEvents = useFetchEvents();
	const getCompletions = useFetchCompletions();
	const getForms = useFetchForms();
	const getSchedules = useFetchSchedules();

	const [events, setEvents] = useState({});
	const [completions, setCompletions] = useState({});
	const [forms, setForms] = useState({});
	const [schedules, setSchedules] = useState({});
	const [recurs, setRecurs] = useState({});

	const [schedulesLoaded, setSchedulesLoaded] = useState(false); // Flag for waiting for schedules to load before defining recurs
	const makeCacheFrame = () => ({ events: new Map(), completions: new Map() }); // Empty cache, use for initialization
	const cacheRef = useRef({
		days: new Set(),
		byID: makeCacheFrame(), // byID.events.get(_id) contains an event 
		byDay: makeCacheFrame() // byDay.events.get(midnightTick) contains a set of event _ids in that day
	});
	const debounceIdRef = useRef(0);
	const genRef = useRef(0);

	const pathFilter = "health/mental/drugs";
	//useEffect(() => console.log(`${pathFilter} events: `, Object.values(events).filter(o => o.path === pathFilter)), [events]);
	//useEffect(() => console.log(`${pathFilter} completions: `, Object.values(completions).filter(o => o.path === pathFilter)), [completions]);
	//useEffect(() => console.log(`${pathFilter} schedules: `, Object.values(schedules).filter(o => o.path === pathFilter)), [schedules]);
	//useEffect(() => console.log(`${pathFilter} recurs: `, Object.values(recurs).filter(o => o.path === pathFilter)), [recurs]);

	/** Add midnight ticks between start and end to ref */
	const ensureDayRef = (start, end) => {
		const days = cacheRef.current.days;
		const ticks = dayTicksBetween(start, end);
		ticks.forEach(t => days.add(t));
	};

	/** Return cache day bucket, create if allowed and necessary (ensure when building cache on new fetch) */
	const getDayBucket = (t, objType, allowCreate = true) => {
		const m = cacheRef.current.byDay[objType];
		let s = m.get(t);
		if (allowCreate && !s) {
			s = new Set();
			m.set(t, s);
		}
		return s;
	};

	/** Update cache byDay and byID with object */
	const updateCache = (obj, objType) => {
		const byID = cacheRef.current.byID[objType];
		const { _id } = obj;
		if (!_id) { throw new Error(`Attempting to update ${objType} cache without _id.`, obj) }

		const oldObj = byID.get(_id)
		byID.set(_id, obj); // Update ID cache
		const newTicks = dayTicksBetween(obj.startStamp, obj.endStamp, true);
		newTicks.forEach(t => getDayBucket(t, objType).add(_id)); // Update byDay cache

		if (oldObj) {
			const oldTicks = dayTicksBetween(oldObj.startStamp, oldObj.endStamp, true);
			oldTicks.forEach(t => !newTicks.has(t) && getDayBucket(t, objType, false).delete(_id));
		}
	};

	/** Remove deleted object from byDay and byID cache */
	const dropFromCache = (_id, objType) => {
		const byID = cacheRef.current.byID[objType];
		const obj = byID.get(_id);
		if (!obj) { return }
		dayTicksBetween(obj.startStamp, obj.endStamp, true).forEach(t => {
			const s = getDayBucket(t, objType, false);
			if (s) { s.delete(_id) }
		});
		byID.delete(_id);
	};

	/** Add fetched objects to cache */
	const cacheFetched = (results, objType) => {
		results.forEach(({ fetched }) => {
			fetched.forEach(o => updateCache(o, objType));
		});
	};

	/** Derive the updated state using cache given new ticks */
	const deriveStateFromCache = (ticks, objType) => {
		const byID = cacheRef.current.byID[objType];

		// Find _ids in cache [startDate, endDate) and adds obj to state
		const newState = {};
		ticks.forEach(t => {
			const b = getDayBucket(t, objType, false) || new Set();
			Array.from(b).forEach(_id => newState[_id] = byID.get(_id));
		});

		// Return new state (prefer still present prev to new)
		return newState;
	};

	/** Calculate estimate of current memory usage by cache */
	const measureMemUsage = () =>
		(cacheRef.current.byID.events.size || 0) * docSizes.events +
		(cacheRef.current.byID.completions.size || 0) * docSizes.completions +
		(Object.keys(recurs).length || 0) * docSizes.recurs +
		(Object.keys(forms).length || 0) * docSizes.forms +
		(Object.keys(schedules).length || 0) * docSizes.schedules

	/** Drop cache outside of dayWindow when triggered (expects to be outside to whatever events, recurs, completions state range is currently) */
	const dropDistantCache = (keepTicks) => {

		for (const objType of ['events', 'completions']) {
			const byDay = cacheRef.current.byDay[objType];
			const byID = cacheRef.current.byID[objType];
			const initLength = byID.size;

			// Get all _ids in [startDate, endDate)
			const present = new Set();
			keepTicks.forEach(t => {
				const s = getDayBucket(t, objType, false);
				if (s) { s.forEach(_id => present.add(_id)) }
			});

			// Drop all _ids not within retained range
			Array.from(byID.keys()).forEach(_id => !present.has(_id) && dropFromCache(_id, objType));

			// Drop all out of range and empty byDay keys (just a little cleanup)
			Array.from(byDay.entries()).forEach(([t, _ids]) => (!keepTicks.has(t) && _ids.size === 0) && byDay.delete(t));

			console.log(`${present.size} ${objType} of ${initLength} remain.`);
		}

		// Update days cached ref
		const prevDays = cacheRef.current.days;
		prevDays.forEach(t => !keepTicks.has(t) && prevDays.delete(t));
	};

	/** Handle updating cache and state on fetch */
	const handleDateChangeFetch = async (currGen) => {
		// Get ticks in new range then find holes that must be fetched to fill each tick in [startDate, endDate)
		const newTicks = dayTicksBetween(startDate, endDate);
		const holes = defFetchRanges(startDate, endDate, cacheRef.current.days);

		// Drop out of range objects when [startDate, endDate) purely shrinks within current range
		if (holes.length > 0) {

			// Request events and completions from [startDate, endDate) holes
			const ePromises = holes.map(({ start, end }) => getEvents(start, end).then(fetched => ({ start, end, fetched })));
			const cPromises = holes.map(({ start, end }) => getCompletions(start, end).then(fetched => ({ start, end, fetched })));
			const [eResults, cResults] = await Promise.all([Promise.all(ePromises), Promise.all(cPromises)]);

			// Guard against stale cache update (request in flight when new request is triggered)
			if (genRef.current !== currGen) { return }

			// Add midnight ticks from holes to daysCachedRef
			holes.forEach(({ start, end }) => ensureDayRef(start, end));

			// Update cache
			cacheFetched(eResults, 'events');
			cacheFetched(cResults, 'completions');
		}

		// Guard against stale state update
		if (genRef.current !== currGen) { return }

		// Update state
		setEvents(deriveStateFromCache(newTicks, 'events'));
		setCompletions(deriveStateFromCache(newTicks, 'completions'));
	};

	// Fetch events & completions on load and time changes
	useEffect(() => {
		if (!user || !startDate || !endDate) { return } // Wait for schedules to load first (and cancel if something is undefined)

		if (debounceIdRef.current) { clearTimeout(debounceIdRef.current) }
		const currGen = ++genRef.current; // Increment on call so any previous fetch is ignored on reception

		debounceIdRef.current = setTimeout(async () => {
			try {

				// Check for overflow and drop edges if overflowing
				const memUsage = measureMemUsage();
				if (memUsage > maxMemUsage) {
					const window = { start: addTime(startDate, { days: -dayWindow }), end: addTime(endDate, { days: dayWindow }) };
					console.log(`${memUsage.toFixed(3)} MB > ${maxMemUsage.toFixed(3)} MB, dropping outside of ${window.start}, ${window.end}`);
					const keepTicks = dayTicksBetween(window.start, window.end);
					dropDistantCache(keepTicks);
					const cleanedMemUsage = measureMemUsage();
					console.log(`Down to ${cleanedMemUsage.toFixed(3)} MB.`);
				}

				await handleDateChangeFetch(currGen);

			} catch (e) {
				console.error("Range change fetch failed:", e);
			}
		}, timeoutLength);

		return () => {
			if (debounceIdRef.current) {
				clearTimeout(debounceIdRef.current);
				++genRef.current;
			}
		}
	}, [user, startDate?.getTime(), endDate?.getTime()]);

	// Compute recurs on load and time changes (wait for schedulesLoaded)
	useEffect(() => {
		if (!user || !startDate || !endDate || !schedulesLoaded) { return } // Wait for schedules to load first (and cancel if something is undefined)
		const newRecurs = getAllRecurs(Object.values(schedules), startDate, endDate, localTZ);
		setRecurs(Object.fromEntries(newRecurs.map(r => [r._id, r])));
	}, [startDate?.getTime(), endDate?.getTime(), schedules, schedulesLoaded, user])

	// Keep _id in path key for quick lookup
	const formIDsByPath = useMemo(() => {
		const m = {};
		Object.values(forms).forEach(f => {
			if (m?.[f.path]) { console.warn("Overwriting non-unique form path: ", f.path) }
			m[f.path] = f._id;
		});
		return m;
	}, [forms]);

	// Load forms on load
	useEffect(() => {
		if (!user) {
			setForms({});
			return;
		}
		getForms()
			.then(fetched => setForms(Object.fromEntries(fetched.map(o => [o._id, o]))))
			.catch(() => setForms({}));
	}, [user]);

	// Keep _ids in path key for quick lookup
	const scheduleIDsByPath = useMemo(() => {
		const m = {};
		Object.values(schedules).forEach(s => {
			if (m?.[s.path]) { m[s.path].push(s._id) }
			else { m[s.path] = [s._id] }
		});
		return m;
	}, [schedules]);

	// Load schedules on load
	useEffect(() => {
		if (!user) {
			setSchedules({});
			setRecurs({});
			setSchedulesLoaded(false);
			return;
		}
		getSchedules()
			.then(fetched => 
				setSchedules(Object.fromEntries(fetched.map(o => [o._id, o]))))
			.then(() => {
				setSchedulesLoaded(true)
			}).catch(() => {
				setSchedules({});
				setRecurs({});
				setSchedulesLoaded(false);
			});
	}, [user]);

	/** Update state and cache with updates/deletions  */
	const updateStateAndCache = (prev, updated, removedID, objType) => {
		let next = prev;

		if (removedID) {
			// Drop removedID from state
			const { [removedID]: _omit, ...rest } = next;
			next = rest;
			// Drop removedID from cache
			dropFromCache(removedID, objType);
		}

		if (updated?._id) {
			// Add updated _id: obj to state
			next = { ...next, [updated._id]: updated };
			// Add/update object in cache
			updateCache(updated, objType);
		}

		return next;
	}

	const upsertComposite = useCallback(
		async (composite) => {

			// normalize your payload
			const { form, event, completion, schedules, dirty, toDelete } = composite;
			const payload = {
				form,
				event,
				completion,
				schedules,
				dirty, 
				toDelete
			};

			console.log("Saving composite:", payload);

			try {
				const saved = await save("composite", "POST", payload);

				console.log("Received saved from backend upsertion:", saved);

				setEvents(prev => updateStateAndCache(prev, ISOsToDates(saved.event), saved?.deletions?.event, 'events'));
				setCompletions(prev => updateStateAndCache(prev, ISOsToDates(saved.completion), saved?.deletions?.completion, 'completions'));
				setForms(prev => ({ ...prev, ...({ [saved.form._id]: saved.form })}));
				const newSchedules = saved.schedules.map((s) => (ISOsToDates(s)));
				setSchedules(prev => ({ ...prev, ...Object.fromEntries(newSchedules.map(s => [s._id, s])) }));
				reduceComposite({ type: 'reset' });

				return saved;
			} catch (e) {
				console.error("saveComposite failed:", e);
				throw e;
			}
		},
		[save, startDate, endDate, localTZ]
	);

	return { upsertComposite, events, forms, completions, schedules, recurs, formIDsByPath, scheduleIDsByPath };
};

export const useChecklistDataHandler = () => {
	const { user } = useUser();
	const save = useSave();
	const fetchChecklist = useFetchChecklist();

	const [checklist, setChecklist] = useState([]);

	// initial loads + parameter changes
	useEffect(() => {
		if (!user) {
			setChecklist([]);
			return;
		}
		fetchChecklist()
			.then(setChecklist)
			.catch(() => setChecklist([]));
	}, [user, fetchChecklist]);

	const upsertChecklist = useCallback(async(task) => {
		try {

			// reformat form from UI to storage structure
			const formToSave = {
				formID: task.formID ?? null,
				participants: task.participants ?? [],
				title: task.title.trim(),
				note: task.note.trim(),
				active: task.active ?? true,
				priority: parseInt(task.priority, 10) ?? 0,
				updatedAt: new Date().toISOString(),
			}

			if (task._id) {
				// Update checklist item
				const updated = await save(`checklist/${task._id}`, 'PUT', formToSave);
				// Update changed item or drop if complete
				console.log(`Updated ${updated.title}`);
			} else {
				// Create new checklist item
				const saved = await save('checklist/new', 'POST', formToSave);
				console.log(`Created ${saved.title}`);
			}
		} catch (err) {
			console.error(`Error updating checklist: ${err}`);
		}
	})

	return { checklist, upsertChecklist };
};
