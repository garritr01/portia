// helpers/DataHandler

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../contexts/UserContext.js';
import { useFetchEvents, useFetchForms, useFetchSchedules } from '../requests/CalendarData.js';
import { useFetchChecklist } from '../requests/ChecklistData.js'; 
import { useSave } from '../requests/General.js';
import { getAllRecurs, timeStampsToDate } from './DateTimeCalcs';

const mergeByID = (all, updated) => {
	// If they passed in an array, fold each element in turn
	if (Array.isArray(updated)) {
		// Make a shallow copy to avoid mutating the original
		const result = [ ...all ];
		updated.forEach(item => {
			const idx = result.findIndex(x => x._id === item._id);
			if (idx > -1) {
				result[idx] = item;
			} else {
				result.push(item);
			}
		});
		return result;
	}

	// Otherwise it's a single object
	const idx = all.findIndex(x => x._id === updated._id);
	if (idx > -1) {
		return all.map(x => (x._id === updated._id ? updated : x));
	} else {
		return [...all, updated];
	}
};

export const useCalendarDataHandler = (startDate, endDate, setShowForm) => {
	const { user } = useUser();
	const save = useSave();
	const fetchEvents = useFetchEvents(startDate, endDate);
	const fetchForms = useFetchForms();
	const fetchSchedules = useFetchSchedules();

	const [events, setEvents] = useState([]);
	const [forms, setForms] = useState([]);
	const [schedules, setSchedules] = useState([]);
	const [schedulesLoaded, setSchedulesLoaded] = useState(false); // Flag for initially defining recurs
	const [recurs, setRecurs] = useState([]);

	// initial loads + parameter changes

	useEffect(() => {
		if (!user || !startDate || !endDate) {
			setEvents([]);
			return;
		}
		fetchEvents()
			.then(setEvents)
			.catch(() => setEvents([]));
	}, [user, startDate, endDate, fetchEvents]);

	useEffect(() => {
		if (!user) {
			setForms([]);
			return;
		}
		fetchForms()
			.then(setForms)
			.catch(() => setForms([]));
	}, [user, fetchForms]);

	useEffect(() => {
		if (!user) {
			setSchedules([]);
			setRecurs([]);
			setSchedulesLoaded(false);
			return;
		}
		fetchSchedules()
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
	}, [user, fetchSchedules]);

	useEffect(() => {
		if (!user || !startDate || !endDate || !schedulesLoaded) {
			setRecurs([]);
			return;
		}
		const allRecurs = getAllRecurs(schedules, startDate, endDate);
		setRecurs(allRecurs);
	}, [user, schedulesLoaded, startDate, endDate]);

	const upsertComposite = useCallback(
		async (composite, dirty) => {

			console.log('composite', composite);
			console.log('dirty', dirty);

			// normalize your payload
			const { form, event, schedules } = composite;
			const payload = {
				form,
				event,
				schedules,
				dirty
			};

			try {
				const saved = await save("events", "POST", payload);

				setForms(prev => mergeByID(prev, saved.form));
				setEvents(prev => mergeByID(prev, timeStampsToDate(saved.event)));
				const newSchedules = saved.schedules.map((s) => (timeStampsToDate(s)));
				setSchedules((prev) => mergeByID(prev, newSchedules));
				setRecurs((prev) => getAllRecurs(newSchedules, startDate, endDate, prev));
				setShowForm({ _id: null });

				return saved;
			} catch (e) {
				console.error("saveComposite failed:", e);
				throw e;
			}
		},
		[save, startDate, endDate]
	);

	return { upsertComposite, events, forms, schedules, recurs };
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
