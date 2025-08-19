// helpers/DataHandler.js

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '../contexts/UserContext.js';
import { useFetchEvents, useFetchCompletions, useFetchForms, useFetchSchedules } from '../requests/CalendarData.js';
import { useFetchChecklist } from '../requests/ChecklistData.js'; 
import { useSave } from '../requests/General.js';
import { getAllRecurs, ISOsToDates } from './DateTimeCalcs';

const mergeUpdate = (all, updated, deleted) => {
	// If they passed in an array, fold each element in turn
	if (Array.isArray(updated) && Array.isArray(deleted)) { // Updated and deleted both array
		// Make a shallow copy to avoid mutating the original
		const old = all.filter(x => !deleted.includes(x._id) && !updated.some(u => u._id === x._id));
		const trueUpdates = updated.filter(x => x._id);
		return [ ...old, ...trueUpdates];
	} else {
		console.warn("Updated and deleted structures are not both arrays.")
		return all;
	}
};

export const useCalendarDataHandler = (startDate, endDate, reduceComposite) => {
	const { user } = useUser();
	const save = useSave();
	const getEvents = useFetchEvents(startDate, endDate);
	const getCompletions = useFetchCompletions(startDate, endDate);
	const getForms = useFetchForms();
	const getSchedules = useFetchSchedules();

	const [events, setEvents] = useState([]);
	const [completions, setCompletions] = useState([]);
	const [forms, setForms] = useState([]);
	const [schedules, setSchedules] = useState([]);
	const [schedulesLoaded, setSchedulesLoaded] = useState(false); // Flag for initially defining recurs
	const [recurs, setRecurs] = useState([]);

	const eventCache = useRef(new Map());

	// initial loads + parameter changes

	useEffect(() => {
		if (!user || !startDate || !endDate) {
			setEvents([]);
			return;
		}
		getEvents()
			.then(utcEvents => setEvents(utcEvents.map(obj => obj)))
			.catch(() => setEvents([]));
	}, [user, startDate.getTime(), endDate.getTime()]);

	useEffect(() => {
		if (!user || !startDate || !endDate) {
			setCompletions([]);
			return;
		}
		getCompletions()
			.then(utcCompletions => setCompletions(utcCompletions.map(obj => obj)))
			.catch(() => setCompletions([]));
	}, [user, startDate.getTime(), endDate.getTime()]);

	useEffect(() => {
		if (!user) {
			setForms([]);
			return;
		}
		getForms()
			.then(setForms)
			.catch(() => setForms([]));
	}, [user]);

	useEffect(() => {
		if (!user) {
			setSchedules([]);
			setRecurs([]);
			setSchedulesLoaded(false);
			return;
		}
		getSchedules()
			.then((data) => {
				setSchedules(data);
				return data;
			}).then(() => {
				setSchedulesLoaded(true)
			}).catch(() => {
				setSchedules([]);
				setRecurs([]);
				setSchedulesLoaded(false);
			});
	}, [user]);

	useEffect(() => {
		if (!user || !startDate || !endDate || !schedulesLoaded) {
			setRecurs([]);
			return;
		}
		const allRecurs = getAllRecurs(schedules, startDate, endDate);
		setRecurs(allRecurs);
	}, [user, schedulesLoaded, startDate.getTime(), endDate.getTime()]);

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

				setForms(prev => mergeUpdate(prev, [saved.form], [saved?.deletions?.form]));
				setEvents(prev => mergeUpdate(prev, [ISOsToDates(saved.event)], [saved?.deletions?.event]));
				setCompletions(prev => mergeUpdate(prev, [ISOsToDates(saved.completion)], [saved?.deletions?.completion]))
				const newSchedules = saved.schedules.map((s) => (ISOsToDates(s)));
				setSchedules((prev) => mergeUpdate(prev, newSchedules, saved?.deletions?.schedules));
				setRecurs((prev) => [
					...prev.filter(r => 
						!newSchedules.some(s => s._id === r.scheduleID) 
						&& !saved?.deletions?.schedules.includes(r.scheduleID)
					), // Filter out old and deleted versions
					...getAllRecurs(newSchedules, startDate, endDate) // Add recurs for new versions
				]);
				reduceComposite({ type: 'reset' });

				return saved;
			} catch (e) {
				console.error("saveComposite failed:", e);
				throw e;
			}
		},
		[save, startDate, endDate]
	);

	return { upsertComposite, events, forms, completions, schedules, recurs };
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
