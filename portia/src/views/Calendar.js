/* Calendar */
import React, { useState, useEffect, useMemo, useReducer } from 'react';
import { useScreen } from '../contexts/ScreenContext';
import {
	clamp,
	returnDates,
	addTime,
	timeDiff,
	normDate,
	monthLength,
	getDayOfWeek,
} from '../helpers/DateTimeCalcs';
import {
	makeEmptyForm,
	makeEmptyEvent,
	makeEmptySchedule,
	initialCompositeState,
	updateComposite,
} from '../helpers/HandleComposite';
import { useSwipe } from '../helpers/DynamicView';
import { useSave } from '../requests/General';
import { DropSelect } from '../components/Dropdown';
import { CompositeForm } from '../components/CompositeForm';
import { Floater } from '../components/Portal';

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
		recurs, // All instances of schedules... for appearing on calendar
		setRecurs, 
		schedules, // All schedules without hard stop before range
		setSchedules, 
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
	const [ showForm, setShowForm ] = useState({ _id: null });
	const [ composite, reduceComposite ] = useReducer(updateComposite, initialCompositeState);
	// autofill/empty form/event/recur based 'showForm' value (_id, 'new', or null)
	// Memos so useEffect doesn't depend on everything
	const eventsMemo = useMemo(() => Object.fromEntries(events.map(e => [e._id, e])),[events]);
	const formsMemo = useMemo(() => Object.fromEntries(forms.map(f => [f._id, f])),[forms]);
	const recursMemo = useMemo(() => [ ...recurs ],[recurs]);
	const schedulesMemo = useMemo(() => [ ...schedules ],[schedules]);
	
	// Autofill form, event, schedules based on event or recur click
	useEffect(() => {
		// Autofill based on defaults
		// console.log("Show Form:", showForm);

		// NEEDS ACTION!!!!!!
		// Set a start and endStamp on the 'new' (+) button click

		if (showForm._id !== null && showForm._id !== 'new') {
			// Autofill based on event
			let newEvent = eventsMemo[showForm._id];
			if (newEvent) {
				// Should always be found
				let newForm = formsMemo[newEvent.formID];
				if (!newForm) {
					console.error(`Form not found from event path: ${newEvent.path}`);
					newForm = makeEmptyForm();
				}

				// None to many may be found
				let newSchedules = schedulesMemo.filter(sched => newEvent.path === sched.path);
				if (!newSchedules) {
					newSchedules = [makeEmptySchedule()];
				}

				reduceComposite({
					type: 'update',
					event: newEvent,
					form: newForm,
					schedules: newSchedules,
				});

				return;
			}

			// Autofill based on recurrence instance and associated schedule
			const recurSched = schedulesMemo.find(sched => showForm._id === sched._id);
			if (recurSched) {
				// Should always be found 
				let newSchedules = schedulesMemo.filter(rule => recurSched.path === rule.path);
				if (!newSchedules) {
					console.error(`schedule not found from selected recur's schedule's path: ${recurSched.path}`);
					newSchedules = [makeEmptySchedule()];
				}

				// Should always be found
				let newForm = formsMemo[newSchedules[0].formID]; // Should all be the same formID
				if (!newForm) {
					console.error(`Form not found from schedule's formID: ${newSchedules[0].formID}`);
					newForm = makeEmptyForm();
				}

				newEvent = { 
					...makeEmptyEvent(),
					scheduleID: showForm._id,
					scheduleStart: showForm.startStamp,
					startStamp: showForm.startStamp,
					endStamp: showForm.endStamp,
				};

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
	}, [showForm, eventsMemo, formsMemo, schedulesMemo, recursMemo]);

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

	// Update the event related stores (directlyPassedRecur is check mark click no additional detail)
	const upsertComposite = async (specDirty) => {
		try {
			
			console.log(composite);
			const { event, form, schedules } = composite;

			let formToSave = { ...form };
			let eventToSave = { ...event };
			let schedulesToSave = [ ...schedules ];

			console.log("On save: ")
			console.log("Sched: ", schedulesToSave);
			console.log("Form: ", formToSave);
			console.log("Event: ", eventToSave);
			console.log("Dirty: ", specDirty);

			if (!form.includeStart) {
				eventToSave.startStamp = event.endStamp; // If no start, set to end for convenience
			}
			
			const saved = await save('events', 'POST', { form: formToSave, event: eventToSave, schedules: schedulesToSave, dirty: specDirty })

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
								.filter(item => (
									timeDiff(normDate(item.startStamp), date).days === 0
									|| timeDiff(normDate(item.endStamp), date).days === 0
								))
								.sort((a, b) => new Date(a.startStamp) - new Date(b.startStamp))
								.map(item => (
									<div className="formRow" key={item.id}>
										<button className="relButton" onClick={() => {
											setShowForm({ _id: item._id, startStamp: item.startStamp, endStamp: item.endStamp });
										}}>{item.path}</button>
										<p className="sep">
											{new Date(item.startStamp).toLocaleString('default', {hour: "2-digit", minute: "2-digit", hour12: false})}
											-
											{new Date(item.endStamp).toLocaleString('default', {hour: "2-digit", minute: "2-digit", hour12: false})}
										</p>
									</div>
								))
							}
							<button className="createButton" onClick={() => {
								reduceComposite({ type: 'reset' });
								setShowForm({ _id: 'new' });
								setFormDate(date);
							}}>+</button>
						</div>
					</div>
				))}
				{showForm._id &&
					<Floater>
						<CompositeForm
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

