/* Calendar */
import React, { useState, useEffect, useMemo, useRef, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { useScreen } from '../contexts/ScreenContext';
import { TypeCheck } from '../helpers/InputValidation';
import {
	clamp,
	returnDates,
	addTime,
	timeDiff,
	normDate,
	editFriendlyDateTime,
	calcFriendlyDateTime,
	viewFriendlyDateTime,
	monthLength,
	getDayOfWeek,
} from '../helpers/DateTimeCalcs';
import { useSwipe, DropSelect, InfDropSelect, invalidInputFlash } from '../helpers/DynamicView';
import { useSave } from '../requests/General';

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
const initialCompositeState = {
	form: makeEmptyForm(),
	event: makeEmptyEvent(),
	schedules: [],
	dirty: { form: false, event: false, schedules: [] },
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
// Reducer for updating composite (event, form, rRule) state
const updateComposite = (state, action) => {
	if (action.type === 'reset') {
		return initialCompositeState;
	} else if (action.type === 'drill') {
		const [objType, ...rest] = action.path;
		if (objType === 'schedules') {
			const [idx, ...schedRest] = rest;
			return {
				...state,
				[objType]: setNested(state.schedules, rest, action.value),
				dirty: {
					...state.dirty,
					// Dirty if already dirty or the edited index
					[objType]: state.dirty.schedules.length > idx ?
						state.dirty.schedules.map((prev, i) => i === idx ? true : prev)
						: [ ...state.dirty.schedules, true ],
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
			dirty: {
				form: state.dirty.form || Boolean(action.form), // Dirty if already dirty, otherwise check for corresponding action
				event: state.dirty.event || Boolean(action.event),
				schedules: action.schedules ? 
					// Dirty if already dirty or no _id (new schedule) - this should only be triggered on delete
					action.schedules.map((s, i) => {
						const wasDirty = (state.dirty.schedules[i] || false);
						const isNew = (s._id === null);
						return (wasDirty || isNew);
					}) : (
						[ ...state.dirty.schedules ]
					)
			},
		}
	}
}

export const YearView = ({ selectedDate, onMonthClick, form, setForm }) => {
	const months = returnDates(selectedDate, 'year');
	const year = selectedDate.getFullYear();

	return (
		<>
			<div className="navigationBar">
				<button className="arrowButton" onClick={() => onMonthClick(addTime(selectedDate, { years: -1 }), 'year')}>❮❮❮</button>
				<button className="navButton">{year}</button>
				<button className="arrowButton" onClick={() => onMonthClick(addTime(selectedDate, { years: 1 }), 'year')}>❯❯❯</button>
			</div>
			<div className="yearView">
				{months.map((date, idx) => (
					<div key={idx} className="monthCell">
						<div className="monthTitle" onClick={() => onMonthClick(date, 'month')}>{date.toLocaleString('default', { month: 'long' })}</div>
						<div className="monthContent"></div>
					</div>
				))}
			</div>
		</>
	);
};

export const MonthView = ({ selectedDate, onDayClick, form, setForm }) => {
	const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const days = returnDates(selectedDate, 'month');
	const month = selectedDate.toLocaleString('default', { month: 'long' });
	const year = selectedDate.getFullYear();
	const weeksToRender = days.slice(35).some(date => date.getMonth() === selectedDate.getMonth()) ? 6 : 5;

	return (
		<>
			<div className="navigationBar">
				<button className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { months: -1 }), 'month')}>❮❮❮</button>
				<button className="navButton" onClick={() => onDayClick(selectedDate, 'year')}>{year}</button>
				<button className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { months: 1 }), 'month')}>❯❯❯</button>
			</div>
			<div className="monthView">
				<div className="weekdayTitle">{month}</div>
				<div className="weekdayRow">
					{weekdays.map((day, idx) => (
						<div key={idx} className="weekdayTitle">{day}</div>
					))}
				</div>
				{Array.from({ length: weeksToRender }).map((_, weekIdx) => (
					<div key={weekIdx} className="monthRow">
						{days.slice(weekIdx * 7, (weekIdx + 1) * 7).map((date, idx) => (
							<div key={idx} className="gridDayCell">
								<div className="gridDayTitle" onClick={() => onDayClick(date, 'day')}>{date.getDate()}</div>
								<div className="gridDayContent"></div>
							</div>
						))}
					</div>
				))}
			</div>
		</>
	);
};

export const DayView = ({ 
		events, // All user in range events (maybe cache later)
		setEvents, // Update in place
		forms, // All user forms always 
		setForms,
		recurs, // All instances of rRules... for appearing on schedule
		setRecurs, 
		rRules, // All rRules without hard stop before range
		setRRules, 
		selectedDate, // Date which range is based on
		days, 
		onDayClick, // Could change span or just selected date, always changes range and causes update
		leftExpanded, // For formatting
		span // View to use
	}) => {
	const save = useSave();
	
	// --- SCREEN SIZE HANDLERS -------------------------------------------------------
	const { smallScreen = false } = useScreen() || {};
	// Switch days via swipe
	useSwipe({
		onSwipeLeft: smallScreen && !leftExpanded ? () => onDayClick(addTime(selectedDate, { days: 1 }), 'day') : null,
		onSwipeRight: smallScreen && !leftExpanded ? () => onDayClick(addTime(selectedDate, { days: -1 }), 'day') : null,
	});

	// --- EVENT/FORM/RECUR HANDLERS --------------------------------------------------
	const [ showForm, setShowForm ] = useState(null);
	const [ composite, reduceComposite ] = useReducer(updateComposite, initialCompositeState);
	// autofill/empty form/event/recur based 'showForm' value (_id, 'new', or null)
	// Memos so useEffect doesn't depend on everything
	const eventsMemo = useMemo(() => Object.fromEntries(events.map(e => [e._id, e])),[events]);
	const formsMemo = useMemo(() => Object.fromEntries(forms.map(f => [f._id, f])),[forms]);
	const recursMemo = useMemo(() => Object.fromEntries(recurs.map(r => [r._id, r])),[recurs]);
	const rRulesMemo = useMemo(() => Object.fromEntries(rRules.map(rr => [rr._id, rr])),[rRules]);
	
	// Autofill form, event, rRule based on event or recur click
	useEffect(() => {
		// Autofill based on defaults
		// console.log("Show Form:", showForm);
		if (showForm !== null && showForm !== 'new') {
			// Autofill based on event
			const newEvent = eventsMemo.find(e => showForm === e._id);
			if (newEvent) {
				// Should always be found
				let newForm = formsMemo.find(f => newEvent.path === f.path);
				if (!newForm) {
					console.error(`Form not found from event path: ${newEvent.path}`);
					newForm = makeEmptyForm();
				}

				// May not be found
				let newSchedules = rRulesMemo.filter(rule => newEvent.path === rule.path);
				if (!newSchedules) {
					newSchedules = [makeEmptySchedule()];
				}

				reduceComposite({
					type: 'update',
					event: newEvent,
					form: newForm,
					schedules: newSchedules,
				});
				return
			}

			// Autofill based on recurrence instance and associated rRule
			const newRecur = recursMemo.find(r => showForm === r._id);
			if (newRecur) {
				// Should always be found 
				let newSchedules = rRulesMemo.filter(rule => newRecur.rRuleID === rule._id);
				if (!newSchedules) {
					console.error(`rRule not found from recur path: ${newRecur.rRuleID}`);
					newSchedules = [makeEmptySchedule()];
				}

				// Should always be found
				let newForm = formsMemo.find(f => newSchedules[0].path === f.path);
				if (!newForm) {
					console.error(`Form not found from rRule path: ${newSchedules[0].path}`);
					newForm = makeEmptyForm();
				}

				reduceComposite({
					type: 'update',
					event: newEvent,
					form: newForm,
					schedules: newSchedules,
				});
				return
			}

			// Should never get here
			console.error("Selection doesn't match recur or event");
			reduceComposite({ type: 'reset' });
		}
	}, [showForm, eventsMemo, formsMemo, rRulesMemo, recursMemo]);

	// --- DATE HANDLERS -------------------------------------------------------
	const month = selectedDate.toLocaleString('default', { month: 'long' });
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
	// Mobile date selection before applying new date
	const [tempDate, setTempDate] = useState(new Date(selectedDate)); 
	// For autofilling datetimes in form
	const [ formDate, setFormDate ] = useState(new Date(selectedDate));

	// Guard against leap year
	const handleYearChange = (newYear) => {
		setTempDate(prev => {
			const d = new Date(prev);
			const desiredDay = d.getDate();
			d.setDate(1);
			d.setFullYear(newYear);
			const daysInMonth = monthLength(d);
			d.setDate(Math.min(desiredDay, daysInMonth));
			return d;
		});
	};

	// Guard against differing month lengths
	const handleMonthChange = (newMonth) => {
		setTempDate(prev => {
			const d = new Date(prev);
			const desiredDay = d.getDate();
			d.setDate(1);
			d.setMonth(newMonth);
			const daysInMonth = monthLength(d);
			d.setDate(Math.min(desiredDay, daysInMonth));
			return d;
		});
	};

	// Safe, only existing days in month present
	const handleDayChange = (newDate) => {
		setTempDate(prev => {
			const d = new Date(prev);
			d.setDate(newDate);
			return d;
		});
	};

	// --- VALIDATION -----------------------------------------------------------
	const validateForm = (form) => {
		if (!TypeCheck(form.path, ['string'])) {
			console.error('Invalid form.path:', form.path)
			return false
		}
		if (!TypeCheck(form.info, ['array'])) {
			console.error('Invalid form.info:', form.info)
			return false
		}
		if (!TypeCheck(form.includeStart, ['boolean'])) {
			console.error('Invalid form.includeStart:', form.includeStart)
			return false
		}
		return true
	}

	const validateEvent = (event) => {
		if (!TypeCheck(event.formID, ['string'])) {
			console.error('Invalid event.formID:', event.formID)
			return false
		}
		if (!TypeCheck(event.recurID, ['string'])) {
			console.error('Invalid event.recurID:', event.recurID)
			return false
		}
		if (!TypeCheck(event.startStamp, ['string'])) {
			console.error('Invalid event.startStamp:', event.startStamp)
			return false
		}
		if (!TypeCheck(event.endStamp, ['string'])) {
			console.error('Invalid event.endStamp:', event.endStamp)
			return false
		}
		return true
	}

	const validateRRule = (recur) => {
		if (!TypeCheck(recur.period, ['string'])) {
			console.error('Invalid recur.period:', recur.period)
			return false
		}
		if (!TypeCheck(recur.interval, ['number']) || recur.interval < 1) {
			console.error('Invalid recur.interval:', recur.interval)
			return false
		}
		if (!TypeCheck(recur.endStamp, ['string'])) {
			console.error('Invalid recur.endStamp:', recur.endStamp)
			return false
		}
		if (!TypeCheck(recur.tz, ['string'])) {
			console.error('Invalid recur.tz:', recur.tz)
			return false
		}
		return true
	}

	// Update the event related stores (directlyPassedRecur is check mark click no additional detail)
	const upsertComposite = async () => {
		try {
			
			console.log(composite);
			const { event, form, schedules, dirty } = composite;

			let formToSave = { ...form };
			let eventToSave = { ...event };
			let schedulesToSave = [ ...schedules ];

			if (!form.includeStart) {
				eventToSave.startStamp = event.endStamp; // If no start, set to end for convenience
			}
			
			/*
			if ( !validateForm(formToSave) || !validateEvent(eventToSave) || !validateRRule(rRuleToSave) ) { 
				console.error(`Invalid save attempt... \nForm: ${validateForm(formToSave)}\nEvent:${validateEvent(eventToSave)}\nrRule:${validateRRule(rRuleToSave)}`);
				return ;
			}
			*/

			const saved = await save('events', 'POST', { form: formToSave, event: eventToSave, schedules: schedulesToSave, dirty })

			if (saved) {
				console.log("Saved returns:", saved);
				reduceComposite({ type: 'reset' });
			}
		} catch (err) {
			console.error('Error in updateComposite:', err)
		}
	}

	return (
		<>
			{/** Calendar Navigation */}
			{false && smallScreen ?
				<div className="dateSelector">
					<DropSelect
						dropID={"navMonth"}
						options={months.map((month, idx) => {
							return {
								display: month,
								value: idx
							};
						})}
						value={{ display: months[tempDate.getMonth()], value: tempDate.getMonth() }}
						onChange={handleMonthChange}
						/>
					<DropSelect
						dropID={"navDay"}
						options={Array.from({ length: monthLength(tempDate) }, (_, idx) => {
							return {
								display: idx + 1,
								value: idx + 1
							};
						})}
						value={{ display: tempDate.getDate(), value: tempDate.getDate() }}
						onChange={handleDayChange}
						/>
					<DropSelect
						dropID={"navYear"}
						options={Array.from({ length: 100 }, (_, idx) => {
							return {
								display: idx + 2000,
								value: idx + 2000
							};
						})}
						value={{ display: tempDate.getFullYear(), value: tempDate.getFullYear() }}
						onChange={handleYearChange}
						/>
					<button onClick={() => onDayClick(tempDate, 'day')}>❯❯❯</button>
				</div>
				:
				<div className="navigationBar">
					<button className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { days: -3 }), 'day')}>❮❮❮</button>
					<button className="navButton" onClick={() => onDayClick(selectedDate, 'month')}>{month}</button>
					<button className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { days: 3 }), 'day')}>❯❯❯</button>
				</div>
			}
			<div className="dayView">
				{days.map((date, idx) => (
					<div key={idx} className={idx === 2 ? 'dayCellLarge' : 'dayCellSmall'}>
						<div
							className={idx === 2 ? 'dayTitleLarge' : 'dayTitleSmall'}
							onClick={() => timeDiff(selectedDate, date).days !== 0 && onDayClick(date, 'day')}
							>
							<span>{date.toLocaleDateString('default', { weekday: 'short' })}</span>
							{smallScreen ?
								<span>{date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}</span>
								: <span>{date.toLocaleDateString('default', { day: 'numeric' })}</span>
							}
						</div>
						<div className={idx === 2 ? 'dayContentLarge' : 'dayContentSmall'}>
							{[...events, ...recurs]
								.sort((a, b) => new Date(a.startStamp) - new Date(b.startStamp))
								.map(evt => (
									<div className="formRow" key={evt.id}>
										{/*
										<button className="submitButton" onClick={() => {
											setForm(evt);
											setShowForm(prev => {
												const show = [...prev];
												show[idx] = !show[idx]
												return show;
											});
										}}>{evt.title}</button>
										<p className="sep">
											{new Date(evt.startStamp).toLocaleString('default', {hour: "2-digit", minute: "2-digit", hour12: false})}
											-
											{new Date(evt.endStamp).toLocaleString('default', {hour: "2-digit", minute: "2-digit", hour12: false})}
										</p>
										*/}
									</div>
								))
							}
							<button className="createButton" onClick={() => {
								reduceComposite({ type: 'reset' });
								setShowForm('new');
								setFormDate(date);
							}}>+</button>
						</div>
					</div>
				))}
				{showForm &&
					<Floater>
						<EventForm
							composite={composite} reduceComposite={reduceComposite}
							setShowForm={setShowForm} upsertComposite={upsertComposite}
							formDate={formDate}
						/>
					</Floater>
				}
			</div>
		</>
	);
};

const Floater = ({ children }) => {
	return createPortal(
		<div className="portal">{children}</div>,
		document.body
	);
};

// #region Hardcoded Time Options

const periodOptions = [
	{ display: 'No Schedule', value: null, altDisplay: "None but this shouldn't appear" },
	{ display: 'No Repeat', value: 'single', altDisplay: "Just once" },
	{ display: 'Daily', value: 'daily', altDisplay: "day" },
	{ display: 'Weekly', value: 'weekly', altDisplay: "week" },
	{ display: 'Monthly', value: 'monthly', altDisplay: "month" },
	{ display: 'Annually', value: 'yearly', altDisplay: "year" },
];
const weekdayOptions = [
	{ display: "Sunday", value: 0 }, 
	{ display: "Monday", value: 1 }, 
	{ display: "Tuesday", value: 2 },
	{ display: "Wednesday", value: 3 }, 
	{ display: "Thursday", value: 4 },
	{ display: "Friday", value: 5 }, 
	{ display: "Saturday", value: 6 }
];
const monthOptions = [
	{ display: "Jan", value: 0 },
	{ display: "Feb", value: 1 },
	{ display: "Mar", value: 2 },
	{ display: "Apr", value: 3 },
	{ display: "May", value: 4 },
	{ display: "June", value: 5 },
	{ display: "July", value: 6 },
	{ display: "Aug", value: 7 },
	{ display: "Sept", value: 8 },
	{ display: "Oct", value: 9 },
	{ display: "Nov", value: 10 },
	{ display: "Dec", value: 11 }
];

// #endregion

const InteractiveTime = ({ text, type, objKey, schedIdx = null, fieldKey, date, reduceComposite }) => {
	const [rawParts, setRawParts] = useState(editFriendlyDateTime(null));
	const [format, setFormat] = useState({ order: [] });

	// define rawParts with date object
	useEffect(() => setRawParts(editFriendlyDateTime(date)), [date]);

	// set format with type arg
	useEffect(() => {
		if (type === 'weekly') { 
			setFormat({ 
				order: ['weekday', 'hour', 'minute'], 
				weekday: '@', 
				hour: ':', 
				minute: '' 
			});
		} else { 
			setFormat({ 
				order: ['month', 'day', 'year', 'hour', 'minute'],
				month: '/',
				day: '/',
				year: '@',
				hour: ':',
				minute: ''
			});
		}
	}, [type]);


	const commitPart = (unit, newVal) => {
		const upDate = calcFriendlyDateTime(unit, date, { ...rawParts, [unit]: newVal});
		if (schedIdx === null && objKey === 'event') {
			// 'event' case
			reduceComposite({ type: 'drill', path: [objKey, fieldKey], value: upDate });
		} else if (objKey === 'schedules') {
			// 'schedules' case
			reduceComposite({ type: 'drill', path: [objKey, schedIdx, fieldKey], value: upDate });
		} else {
			console.warn("Unexpected combination of objKey and schedIdx: ", objKey, schedIdx);
		}
	}

	const createDefaults = (unit) => {
		if (unit === 'weekday') { return weekdayOptions[Number(rawParts[unit])] }
		if (unit === 'month') { return monthOptions[Number(rawParts[unit]) - 1] }
		if (unit === 'day') { return { display: rawParts[unit], value: Number(rawParts[unit]) } }
		if (unit === 'hour') { return { display: rawParts[unit], value: Number(rawParts[unit]) } }
		if (unit === 'minute') { return { display: rawParts[unit], value: Number(rawParts[unit]) } }
		return { display: 'No Options', value: 0 };
	}

	const createOptions = (unit) => {
		if (unit === 'weekday') { return weekdayOptions }
		if (unit === 'month') { return monthOptions }
		if (unit === 'day') { return Array.from({ length: monthLength(date) }, (_, idx) => ({ display: String(idx + 1), value: (idx + 1)})) }
		if (unit === 'hour') { return Array.from({ length: 24 }, (_, idx) => ({ display: String(idx), value: idx })) }
		if (unit === 'minute') { return Array.from({ length: 60 }, (_, idx) => ({ display: String(idx), value: idx })) }
		return [{ display: 'No Options', value: 0 }];
	}

	return (
		<div className="formRow" id="endDateTime">
			<p className="sep">{text}</p>
			{format.order.map((unit) => (
				<React.Fragment key={`${fieldKey}_${unit}`}>
					<div className="formCell">
						{unit === 'year' ? 
							<InfDropSelect
								value={{ display: String(date.getFullYear()), value: date.getFullYear() }}
								setter={(newVal) => commitPart(unit, newVal)}
								allowType={true}
								/>
							:
							<DropSelect
								options={createOptions(unit)}
								value={createDefaults(unit)}
								setter={(newVal) => commitPart(unit, newVal)}
								allowType={(unit !== 'weekday' && unit !== 'month')}
								/>
						}
					</div>
					<p className="sep">{format[unit]}</p>
				</React.Fragment>
			))}
		</div>
	)
}

const EventForm = ({ composite, reduceComposite, setShowForm, upsertComposite }) => {

	const { form, event, schedules, dirty } = composite;
	const [editRRule, setEditRRule] = useState(null);
	const schedule = editRRule !== null ? schedules[editRRule] : null;
	const [edit, setEdit] = useState(false);

	// Holds last state for easy reversion
	const ogState = useRef({
		form: { ...form, info: [...form.info] },
		schedule: editRRule !== null ? { ...schedules[editRRule] } : {},
	});


	//useEffect(() => console.log("form:\n", form), [form]);
	//useEffect(() => console.log("event:\n", event), [event]);
	//useEffect(() => console.log("schedules:\n", schedules), [schedules]);
	//useEffect(() => console.log("dirty:\n", dirty), [dirty]);

	/** REVERT OR COMMITS TO SCHED OR FORM */
	//#region

	const handleRevertForm = () => {
	  reduceComposite({ type: 'update', form: ogState.current.form });
	  setEdit(false);
	};

	const handleCommitForm = () => {
		ogState.current.form = {
			...form,
			info: [...form.info]
		};
		setEdit(false);
		updateEventUI(form.info);
	};

	// Update event info for filling out based on form info without removing event content already present
	const updateEventUI = (updatedFormInfo) => {
		const updatedEventInfo = updatedFormInfo.map((f, idx) => {
			const prevEvent = event.info.find(e => (e.label === f.label && 'content' in e));
			if (prevEvent) {
				return { ...f, content: prevEvent.content };
			} else {
				const emptyContent = f.type === 'input' ? [''] : null;
				return { ...f, content: emptyContent }
			}
		});
		reduceComposite({
			type: 'update',
			event: {
				...event,
				info: updatedEventInfo,
			}
		})
	};

	// Reset to last committed state
	const handleRevertSchedule = () => {
		// Revert if ogState is not empty, otherwise delete
		const old = ogState.current.schedule;
		if (old && Object.keys(old).length > 0) {
			console.log("Reverting existing og schedule.")
			reduceComposite({ 
				type: 'drill',
				path: ['schedules', editRRule], 
				value: old,
			});
		} else {
			console.log("Reverting absent og schedule.")
			reduceComposite({ type: 'update', schedules: schedules.filter((_, i) => i !== editRRule) });
		}
    setEditRRule(null);
  };

	const handleCommitSchedule = () => {
		// Push endStamp a week forward if weekly and before start stamp (hack to allow weekly event sat -> sun etc)
		const pushEndByWeek = schedule.period === 'weekly' && schedule.endStamp < schedule.startStamp;
		const newSchedule = {
			...schedule,
			endStamp: pushEndByWeek ? addTime(schedule.endStamp, { days : 7 }) : schedule.endStamp,
		};
		reduceComposite({ type: 'drill', path: ['schedules', editRRule], value: newSchedule });
		ogState.current.schedule = newSchedule;
		setEditRRule(null);
	};

	//#endregion

	/** UPDATE FORM OR EVENT */
	//#region

	const changeField = (path, val) => {
		reduceComposite({
			type: 'drill',
			path: path,
			value: val
		});
	};

	const addField = (type) => {
		const newField = type === 'mc'
			? { type, label: '', options: [null] }
			: type === 'tf'
			? { type, label: '' }
			: type === 'input'
			? { type, label: '', placeholder: '', suggestions: [] }
			: { type, label: '', placeholder: '' };
		reduceComposite({
			type: 'update',
			form: { ...form, info: [...form.info, newField] },
		});
	};

	// Implement drag and drop later
	const useFieldDrag = (fromIndex, toIndex) => {
		const infoCopy = [...form.info];
		const [movedField] = infoCopy.splice(fromIndex, 1);
		infoCopy.splice(toIndex, 0, movedField);
		reduceComposite({
			type: 'update',
			form: { ...form, info: infoCopy },
		});
	};

	const deleteField = (idx) => {
		const info = form.info.filter((_, i) => i !== idx);
		reduceComposite({
			type: 'update',
			form: { ...form, info },
		});
	};

	const addOption = (idx) => {
		if (form.info[idx].type !== 'mc') {
			console.warn("Cannot add option from non-mc field");
			return;
		} 

		const optionsCopy = [...form.info[idx].options];
		reduceComposite({
			type: 'drill',
			path: ['form', 'info', idx, 'options'],
			value: [...optionsCopy, null]
		});
	};

	const removeOption = (fieldIdx, optIdx) => {
		if (form.info[fieldIdx].type !== 'mc') {
			console.warn("Cannot remove option from non-mc field");
			return;
		} 

		const optionsCopy = [...form.info[fieldIdx].options];
		const updatedOptions = optionsCopy.filter((_, i) => i !== optIdx);
		reduceComposite({
			type: 'drill',
			path: ['form', 'info', fieldIdx, 'options'],
			value: updatedOptions
		});
	};

	const addInput = (idx) => {
		if (event.info[idx].type !== 'input') {
			console.warn("Cannot add input from non-input field");
			return;
		} else {
			console.log("Adding to ", event.info[idx])
		}

		const contentCopy = [...event.info[idx].content];
		reduceComposite({
			type: 'drill',
			path: ['event', 'info', idx, 'content'],
			value: [...contentCopy, null]
		});
	}

	const removeInput = (fieldIdx, inpIdx) => {
		if (event.info[fieldIdx].type !== 'input') {
			console.warn("Cannot remove input from non-input field");
			return;
		}

		const contentCopy = [...event.info[fieldIdx].content];
		const updatedContent = contentCopy.filter((_, i) => i !== inpIdx);
		reduceComposite({
			type: 'drill',
			path: ['event', 'info', fieldIdx, 'content'],
			value: updatedContent
		});
	};

	//#endregion

	return (
		<div className="form wButtonRow">

			{/** Path */}
			<div className="formRow">	
				<p className="sep">Path</p>
				<input
					className="formCell"
					placeholder="work/projects/..."
					value={form.path || ''}
					onChange={e => {
						changeField(['form', 'path'], e.target.value);
						changeField(['event', 'path'], e.target.value);
						changeField(['schedules', 'path'], e.target.value);
					}}
				/>
			</div>

			{/** SCHEDULE */}
			{schedule ? (
				<div className="form">
					<strong>Schedule</strong>
					
					{/** PERIOD */}
					<div className="formRow">
						<p className="sep">Period</p>
						<div className="formCell">
						<DropSelect
							options={periodOptions}
							value={periodOptions.find((option) => schedule.period === option.value)}
							setter={(newVal) => reduceComposite({
								type: 'drill',
								path: ['schedules', editRRule, 'period'],
								value: newVal
							})}
							/>
							</div>
					</div>
					
					{/** INTERVAL */}
					<div className="formRow">
						{schedule.period && schedule.period !== 'single' &&
							<>
								<p className="sep">Every</p>
								<div className="formCell">
									<InfDropSelect
										min={1}
										value={{ display: String(schedule.interval), value: schedule.interval }} // Just so I can use the same View for both DropSelects
										setter={(newVal) => reduceComposite({
											type: 'drill',
											path: ['schedules', editRRule, 'interval'],
											value: Number(newVal)
										})}
										allowType={true}
									/>
								</div>
								<p className="sep">
									{periodOptions.find((opt) => opt.value === schedule.period)?.altDisplay || ''}
									{schedule.interval > 1 && 's'}
								</p>
							</>
						}
					</div>

					{/** ANCHOR EVENT */}
					{schedule.period &&
						<div className="form">
							{schedule.period !== "single" && <strong>Anchor Event</strong>}
							<InteractiveTime
								text={'Start'}
								type={schedule.period}
								objKey={'schedules'}
								schedIdx={editRRule}
								fieldKey={'startStamp'}
								date={new Date(schedule.startStamp)}
								reduceComposite={reduceComposite}
							/>
							<InteractiveTime
								text={'End'}
								type={schedule.period}
								objKey={'schedules'}
								schedIdx={editRRule}
								fieldKey={'endStamp'}
								date={new Date(schedule.endStamp)}
								reduceComposite={reduceComposite}
							/>
						</div>
					}

					{/** EFFECTIVE RANGE */}
					{schedule.period && schedule.period !== 'single' &&
						<div className="form">
							<strong>Effective Range</strong>
							<InteractiveTime
								text={'Start'}
								objKey={'schedules'}
								schedIdx={editRRule}
								fieldKey={'startRangeStamp'}
								date={new Date(schedule.startRangeStamp)}
								reduceComposite={reduceComposite}
							/>				
							<InteractiveTime
								text={'End'}
								objKey={'schedules'}
								schedIdx={editRRule}
								fieldKey={'endRangeStamp'}
								date={new Date(schedule.endRangeStamp)}
								reduceComposite={reduceComposite}
							/>
						</div>
					}
				</div>
			) 
			: /** WHEN SCHED CLOSED AND NOT-EMPTY */
			(schedules.length > 0) && 
				<div className="form">
					<div className="formRow"><strong className="formCell">Schedules</strong></div>
						{schedules.map((rule, idx) => 
							rule.period && (
								<div className="form wButtonRow">
									<div className="submitRow right">
										<button className="submitButton" onClick={() => {
											setEditRRule(idx);
										}}>
											Edit
										</button>
										<button className="submitButton" onClick={() => {
											reduceComposite({ type: 'update', schedules: schedules.filter((_, i) => i !== idx) });
										}}>
											x
										</button>
									</div>
									<div className="formRow">
										<strong className="formCell">Anchor:</strong>
										<p className="formCell">{viewFriendlyDateTime(rule.startStamp)}</p> 
										<p className="formCell">-</p>
										<p className="formCell">{viewFriendlyDateTime(rule.endStamp, true)}</p> 
									</div>
									{rule.period !== 'single' && 
										<div className="formRow">
											<strong className="formCell">Repeat:</strong>
											<p className="formCell">Every</p>
											{rule.interval > 1 ?
												<p className="formCell">{rule.interval} { periodOptions.find((opt) => opt.value === rule.period)?.altDisplay || 'No Alt Display?' }s</p>
												: <p className="formCell">{periodOptions.find((opt) => opt.value === rule.period)?.altDisplay || 'No Alt Display?' }</p>
											}
										</div>
									}
								</div>
							)
						)}
				</div>
			}

			{/** ADD FORM ELEMENT ROW */}
			{edit && (
				<div className="formRow">
					<button className="relButton" onClick={() => addField('text')}>Text Box</button>
					<button className="relButton" onClick={() => addField('input')}>Input</button>
					<button className="relButton" onClick={() => addField('tf')}>T/F</button>
					<button className="relButton" onClick={() => addField('mc')}>Mult. Choice</button>
					<button
						className={`relButton ${form.includeStart ? 'selected' : ''}`}
						onClick={() =>
							reduceComposite({
								type: 'update',
								form: { ...form, includeStart: !form.includeStart },
							})
						}>
						Start
					</button>
				</div>
			)}

			{/** EDIT FORM ELEMENTS */}
			{edit && form.info.map((f, idx) => (
					<React.Fragment key={idx}>
						<div className="formRow">
							<input
								className="formCell"
								placeholder="Label..."
								value={f.label}
								onChange={e => changeField(['form', 'info', idx, 'label'], e.target.value)}
							/>
							{f.type === 'input' ?
									<input 
										className="formCell"
										placeholder="Placeholder..."
										value={f.placeholder}
										onChange={e => changeField(['form', 'info', idx, 'placeholder'], e.target.value)}
									/>
								: f.type === 'tf' ?
									<>
										<button className="relButton">True</button>
										<button className="relButton">False</button>
									</>
								: null
							}
							<button className="relButton" onClick={() => deleteField(idx)}>×</button>
							{/* <button className="relButton" onPointerDown={() => startFieldDrag(idx)}>⇅</button> */}
						</div>
						{f.type === 'text' ?
							<div className="formRow">
								<textarea 
									className="formCell"
									placeholder="Placeholder..."
									value={f.placeholder}
									onChange={e => changeField(['form', 'info', idx, 'placeholder'], e.target.value)}
								/>
							</div>
							: f.type === 'mc' ?
								<div className="formRow">
									{f.options.map((opt, optIdx) => (
										<React.Fragment key={optIdx}>
											<input
												className="formCell"
												placeholder={`Option ${optIdx + 1}...`}
												value={opt}
												onChange={e => changeField(['form', 'info', idx, 'options', optIdx], e.target.value)}
											/>
											<button className="relButton" onClick={() => removeOption(idx, optIdx)}>×</button>
										</React.Fragment>
									))}
									<button className="relButton" onClick={() => addOption(idx)}>+</button>
								</div>
							: null
						}
					</React.Fragment>
			))}

			{/** EVENT INFO INPUT */}
			{!edit && event.info.map((f, idx) => (
				<React.Fragment key={idx}>
					<div className="formRow" key={idx}>
						<p className="sep">{f.label}</p>
						{f.type === 'input' ?
								<>
									{f.content.map((inp, inpIdx) => (
										<React.Fragment key={inpIdx}>
											<input key={inpIdx}
												className="formCell"
												placeholder={f.placeholder + '...'}
												value={inp}
												onChange={e => changeField(['event', 'info', idx, 'content', inpIdx], e.target.value)}
											/>
											<button className="relButton" onClick={() => removeInput(idx, inpIdx)}>×</button>
										</React.Fragment>
									))}
									<button className="relButton" onClick={() => addInput(idx)}>+</button>
								</>
							: f.type === 'tf' ?
								<>
									<button className={`relButton ${f.content === true ? 'selected' : ''}`} 
										onClick={() => changeField(['event', 'info', idx, 'content'], f.content === true ? null : true)}>
										True
									</button>
									<button className={`relButton ${f.content === false ? 'selected' : ''}`} 
										onClick={() => changeField(['event', 'info', idx, 'content'], f.content === false ? null : false)}>
										False
									</button>
								</>
							: null
						}
					</div>
					{f.type === 'text' ?
							<textarea 
								className="formRow" 
								placeholder={f.placeholder + '...'}
								value={f.content}
								onChange={e => changeField(['event', 'info', idx, 'content'], e.target.value)}
								/>
						: f.type === 'mc' ?
							<div className="formRow">
								{f.options.map((opt, optIdx) => (
									<button key={optIdx}
										className={`relButton ${f.content === opt ? 'selected' : ''}`}
										onClick={() => changeField(['event', 'info', idx, 'content'], f.content === opt ? null : opt)}>
										{opt}
									</button>
								))}
							</div>
						: null
					}
				</React.Fragment>
			))}

			{/** EVENT SPAN */}
			{form?.includeStart && 
				// text, type, objKey, schedIdx, fieldKey, date, reduceComposite
				<InteractiveTime
					text={'Start'}
					type={'full'}
					objKey={'event'}
					fieldKey={'startStamp'}
					date={new Date(event.startStamp)}
					reduceComposite={reduceComposite}
					/>
			}
			<InteractiveTime
				text={'End'}
				type={'full'}
				objKey={'event'}
				fieldKey={'endStamp'}
				date={new Date(event.endStamp)}
				reduceComposite={reduceComposite}
				/>

			{/** ACTIONS */}
			<div className="submitRow right">
				{schedule !== null ?
					<>
						<button className="submitButton" onClick={() => {
							handleRevertSchedule();
							setEditRRule(null);
						}}>Revert Schedule</button>
						<button className="submitButton" onClick={() => {
							handleCommitSchedule();
							setEditRRule(null);
						}}>Commit Schedule</button>
					</>
					:
					<button 
						className="submitButton" 
						onClick={() => {
							setEditRRule(schedules.length);
							reduceComposite({ type: 'drill', path: ['schedules', schedules.length], value: makeEmptySchedule() });
						}}>
						New Schedule
					</button>
				}
				{edit ?
					<>
						<button className="submitButton" onClick={() => {
							handleRevertForm();
							setEdit(false);
						}}>Revert Form</button>
						<button className="submitButton" onClick={() => {
							handleCommitForm();
							setEdit(false);
						}}>Commit Form</button>
					</>
					:
					<button className="submitButton" onClick={() => setEdit(true)}>Edit Form</button>
				}
				<button className="submitButton" onClick={() => upsertComposite()}>Save</button>
				<button className="submitButton add" onClick={() => setShowForm(null)}>-</button>
			</div>
		
		</div>
	);
}

