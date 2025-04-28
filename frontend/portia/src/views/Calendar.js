import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useScreen } from '../contexts/ScreenContext';
import { TypeCheck } from '../helpers/InputValidation';
import { returnDates, addTime, timeDiff, normDate, monthLength, makeDateParts, makeSafeDate, objectToRRuleString } from '../helpers/DateTimeCalcs';
import { useSwipe, DropSelect, invalidInputFlash } from '../helpers/DynamicView';
import { useSave } from '../requests/General';

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

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
	const defaultTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	
	// --- SCREEN SIZE HANDLERS -------------------------------------------------------
	const { smallScreen = false } = useScreen() || {};
	// Switch days via swipe
	useSwipe({
		onSwipeLeft: smallScreen && !leftExpanded ? () => onDayClick(addTime(selectedDate, { days: 1 }), 'day') : null,
		onSwipeRight: smallScreen && !leftExpanded ? () => onDayClick(addTime(selectedDate, { days: -1 }), 'day') : null,
	});

	// --- EVENT/FORM/RECUR HANDLERS --------------------------------------------------
	// update all ON, turn OFF in empty later
	const emptyForm = useMemo(() => ({
		_id: null, // Carry _id if already exists
		update: false, // Flag for updating
		path: '', // For display and maybe filesystem use later
		info: [], // Event info minus content
		includeStart: false, // Initialize form w/ or w/o startTime - (no startTime just sets to endTime)
	}), []);
	const emptyEvent = useMemo(() => ({ 
		_id: null,
		update: false,
		formID: null, // Stores initial form used to create event form, updates based on new state of form
		recurID: null, // Stores the recurID
		path: '',
		recurStart: new Date(), // Store the rRule instance's timestamp
		info: [] , 
		startStamp: new Date(), // Define start time of event
		endStamp: new Date(), 
	}), []);
	const emptyRRule = useMemo(() => ({
		_id: null,
		update: false,
		path: '',
		formID: null, // Form to access for recording
		startStamp: new Date(),
		duration: 0,
		period: '', // daily/weekly/monthly/yearly
		interval: '1', // Every other day/week etc...
		spec: [], // [0, 1, 6] -> Sun, Mon, Sat or Jan, Feb, Jul etc...
		endStamp: new Date(), // Hard stop - set on update!!
		tz: defaultTZ, // time zone
	}), [defaultTZ]);
	const [ showForm, setShowForm ] = useState(null);
	const [ form, setForm ] = useState(null);
	const [ event, setEvent ] = useState(null);
	const [ rRule, setRRule ] = useState(null);
	// autofill/empty form/event/recur based 'showForm' value (_id, 'new', or null)
	// Memos so useEffect doesn't depend on everything
	const eventsMemo = useMemo(() => Object.fromEntries(events.map(e => [e._id, e])),[events]);
	const formsMemo = useMemo(() => Object.fromEntries(forms.map(f => [f._id, f])),[forms]);
	const recursMemo = useMemo(() => Object.fromEntries(recurs.map(r => [r._id, r])),[recurs]);
	const rRulesMemo = useMemo(() => Object.fromEntries(rRules.map(rr => [rr._id, rr])),[rRules]);

	useEffect(() => {
		// Autofill based on defaults

		/*
		if (showForm === null || showForm === 'new') {
			setForm(emptyForm);
			setEvent(emptyEvent);
			setRRule(emptyRRule);
		} else {
			// Autofill based on event
			const newEvent = eventsMemo[showForm];
			if (newEvent) {
				setEvent(newEvent);
				
				// Should always be found
				const newForm = formsMemo[showForm];
				if (!newForm) {
					console.error(`Form not found from eventID: ${newEvent.formID}`);
					setForm(emptyForm);
				} else {
					setForm(formsMemo[showForm]);
				}

				// May not be found
				const newRRule = recursMemo[showForm];
				if (!newRRule) {
					setRRule(emptyRRule);
				} else {
					setRRule(newRRule);
				}

				return
			}

			// Autofill based on recurrence instance and associated rRule
			const newRecur = recursMemo[showForm];
			if (newRecur) {

				// Should always be found 
				const newRRule = rRulesMemo[showForm];
				if (!newRRule) {
					console.error(`rRule not found from recurID: ${newRecur.formID}`);
					setRRule(emptyRRule);
					setForm(emptyForm);
					setEvent(emptyEvent);
				}

				// Should always be found
				const newForm = formsMemo[showForm];
				if (!newForm) {
					console.error(`Form not found from rRuleID: ${newRRule.formID}`);
					setForm(emptyForm);
					setEvent(emptyEvent);
				} else {
					setForm(newForm);
					const newStart = new Date(newRecur.startStamp);
					const newEnd = new Date(newStart.getTime() + newRecur.duration); // duration is ms
					setEvent({ 
						...emptyEvent, 
						formID: newForm._id,
						recurID: newRecur._id,
						recurStart: newStart,
						info: newForm.info,
						startStamp: newStart,
						endStamp: newEnd
					});
				}

				return
			}

			// Should never get here
			console.error("Selection doesn't match recur or event");
		}*/
		setEvent(emptyEvent);
		setForm(emptyForm);
	}, [showForm, eventsMemo, formsMemo, rRulesMemo, recursMemo, emptyEvent, emptyForm, emptyRRule]);

	// --- DATE HANDLERS -------------------------------------------------------
	const month = selectedDate.toLocaleString('default', { month: 'long' });
	// Mobile date selection before applying new date
	const [ tempDate, setTempDate ] = useState(new Date(selectedDate)); 
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
		if (form.path && !TypeCheck(form.path, ['string'])) {
			console.error('Invalid form.path:', form.path)
			return false
		}
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
		if (event.path && !TypeCheck(event.path, ['string'])) {
			console.error('Invalid event.path:', event.path)
			return false
		}
		if (event.formID && !TypeCheck(event.formID, ['string'])) {
			console.error('Invalid event.formID:', event.formID)
			return false
		}
		if (event.recurID && !TypeCheck(!event.recurID, ['string'])) {
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

	const validateRecur = (recur) => {
		if (recur.update) {
			if (recur.path && !TypeCheck(recur.path, ['string'])) {
				console.error('Invalid recur.path:', recur.path)
				return false
			}
			if (!TypeCheck(recur.period, ['string'])) {
				console.error('Invalid recur.period:', recur.period)
				return false
			}
			if (!TypeCheck(recur.interval, ['number']) || recur.interval < 1) {
				console.error('Invalid recur.interval:', recur.interval)
				return false
			}
			if (!TypeCheck(recur.spec, ['array'])) {
				console.error('Invalid recur.spec:', recur.spec)
				return false
			}
			if (!TypeCheck(recur.startStamp, ['string'])) {
				console.error('Invalid recur.endStamp:', recur.startStamp)
				return false
			}
			if (recur.endStamp !== null && !TypeCheck(recur.endStamp, ['string'])) {
				console.error('Invalid recur.endStamp:', recur.endStamp)
				return false
			}
		}
		return true
	}


	useEffect(() => {console.log(events)}, [events]);

	// Update the event related stores (directlyPassedRecur is check mark click no additional detail)
	const compositeUpdate = async (startParts, endParts, recurStartParts, recurEndParts, directlyPassedRecur = null) => {
		try {
			
			/*
			let srcForm, srcRRule, srcEvent;
			// Complete rRule instance (store completion doc) and store as empty event
			if (directlyPassedRecur) {
				srcForm = emptyForm;
				srcRRule = emptyRRule;
				const newStart = new Date(directlyPassedRecur.startStamp);
				const newEnd = new Date(newStart.getTime() + directlyPassedRecur.duration); // duration is ms
				srcEvent = {
					...emptyEvent,
					update: true,
					formID: '',
					recurID: directlyPassedRecur._id,
					recurStart: newStart.toISOString(),
					info: [],
					startStamp: newStart.toISOString(),
					endStamp: newEnd.toISOString()
				};
			} else {
				srcForm = form;
				srcRRule = rRule;
				srcEvent = event;
			}
			
			// Define the events to be saved - provide 
			const formToSave = {
				_id: srcForm._id,
				update: srcForm.update,
				path: srcForm.path.trim(),
				info: srcForm?.info,
				includeStart: srcForm.includeStart,
			}*/

			const srcEvent = event; 
			//update: srcEvent.update,
			//formID: formToSave._id,
			//recurID: srcEvent.recurID,
			//recurStart: srcEvent.recurStart,
			const eventToSave = {
				_id: srcEvent._id,
				path: srcEvent.path.trim(),
				info: srcEvent?.info,
				startStamp: new Date(makeSafeDate(startParts)).toISOString(),
				endStamp: new Date(makeSafeDate(endParts)).toISOString(),
			}

			/*let rRuleToSave;
			if (rRule.period && rRule.interval && rRule) {
				rRuleToSave = {
					_id: srcRRule._id,
					update: srcRRule.update,
					formID: srcRRule.formID,
					path: '',
					startStamp: new Date(makeSafeDate(recurStartParts)).toISOString(),
					rule: objectToRRuleString(srcRRule),
					spec: srcRRule.spec,
					endStamp: recurEndParts ? new Date(makeSafeDate(recurEndParts)).toISOString() : recurEndParts,
					tz: srcRRule.tz,
				}
			} else {
				rRuleToSave = { update: false };
			}*/

			if ( !validateEvent(eventToSave)) { // || !validateEvent(eventToSave) || !validateRecur(rRuleToSave) ) { 
				console.error(`Invalid save attempt`);//... \nForm: ${validateForm(formToSave)}\nEvent:${validateEvent(eventToSave)})\nrRule:${validateRecur(rRuleToSave)}`);
				return ;
			}

			const saved = await save('events', 'POST', { form: eventToSave });//, event: eventToSave, rRule: rRuleToSave })

			if (saved.eventID) {
				setEvents(prev => [...prev, { ...eventToSave, "_id": saved.eventID, "startStamp": makeSafeDate(startParts), "endStamp": makeSafeDate(endParts) }]);
				setRecurs(['new']);
			}/* if (saved.formID) {
				setForms(prev => [...prev, { ...formToSave, "_id": saved.formID, "startStamp": makeSafeDate(startParts), "endStamp": makeSafeDate(endParts) }]);
			} if (saved.rRule) {
				setRRules();
			} if (saved.recur) {
				setRecurs();
			}*/
		} catch (err) {
			console.error('Error in updateComposite:', err)
		}
	}

	return (
		<>
			{smallScreen ?
				<div className="dateSelector">
					<DropSelect
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
							{events
								.map((evt, idx2) => { 
									const evtStart = new Date(evt.startStamp)
									const evtEnd = new Date(evt.endStamp)
									return (
										date.getDate() == evtStart.getDate() || date.getDate() - evtEnd.getDate() == 0 &&
										<div className="formRow" key={idx2}>
											<p className="relButton" onClick={() => {
												setForm(evt);
												setShowForm(evt._id);
											}}>{evt.path}</p>
											<p className="formCell">
												{new Date(evt.startStamp).toLocaleString('default', {hour: "2-digit", minute: "2-digit", hour12: false})}
												-
												{new Date(evt.endStamp).toLocaleString('default', {hour: "2-digit", minute: "2-digit", hour12: false})}
											</p>
										</div>
									)})
							}
							<button className="createButton" onClick={() => {
								setFormDate(date);
								setShowForm('new');
							}}>+</button>
							{showForm &&
								<Floater>
									<EventForm 
										event={event} setEvent={setEvent} 
										form={form} setForm={setForm} 
										rRule={rRule} setRRule={setRRule} 
										setShowForm={setShowForm} compositeUpdate={compositeUpdate} 
										formDate={formDate}
										/>
								</Floater>
							}
						</div>
					</div>
				))}
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

const EventForm = ({ event, setEvent, form, setForm, rRule, setRRule, setShowForm, compositeUpdate, formDate }) => {

	// form, event, or rRule
	const [ editRecur, setEditRecur ] = useState(false);
	const [ edit, setEdit ] = useState(false);
	const [ recurStartParts, setRecurStartParts ] = useState(makeDateParts(new Date(formDate)));
	const [ recurEndParts, setRecurEndParts ] = useState(makeDateParts(new Date(formDate)));
	const [ startParts, setStartParts ] = useState(makeDateParts(new Date(formDate)));
	const [ endParts, setEndParts ] = useState(makeDateParts(new Date(formDate)));

	const changeField = (idx, key, val) => {
		//setForm(prev => ({
		//	...prev,
		//	info: prev?.info.map((f, i) =>
		//		i === idx ? { ...f, [key]: val } : f
		//	)
		//}));
		setEvent(prev => ({
			...prev,
			info: prev?.info.map((f, i) =>
				i === idx ? { ...f, [key]: val } : f
			)
		}));
	}

	const addField = (type) => {
		//setForm(prev => ({
		//	...prev,
		//	info: [
		//		...prev?.info,
		//		{ type: type, label: '', content: ''}
		//	]
		//}));
		setEvent(prev => ({
			...prev,
			info: [
				...prev?.info,
				{ type: type, label: '', content: '' }
			]
		}));
	}

	const deleteField = (idx) => {
		//setForm(prev => ({
		//	...prev,
		//	info: prev?.info.filter((f, i) => i !== idx)
		//}));
		setEvent(prev => ({
			...prev,
			info: prev?.info.filter((f, i) => i !== idx)
		}));
	}

	return (
		<div className="form">
			{/* path */}
			<div className="formRow">
				<p className="formCell">Path</p>
				<input
					className="formCell"
					placeholder="path/to/event/type..."
					value={event.path || ''}
					onChange={e => {
						//setForm({ ...form, path: e.target.value });
						//setRRule({ ...rRule, path: e.target.value });
						setEvent({ ...event, path: e.target.value });
					}}/>
			</div>

			{/* recurrence rule */}
			{/*editRecur ?
				<>
					<div className="formRow">
						<p className="formCell">Every</p>
						<input
							type="number"
							min={1}
							className="formCell"
							value={rRule.interval}
							onChange={e =>
								setRRule(prev => ({
									...prev,
									interval: parseInt(e.target.value, 10) || 1
								}))
							}
						/>
						<select
							className="formCell"
							value={rRule.period}
							onChange={e =>
								setRRule(prev => ({ ...prev, period: e.target.value }))
							}>
							<option value="daily">day(s)</option>
							<option value="weekly">week(s)</option>
							<option value="monthly">month(s)</option>
							<option value="yearly">year(s)</option>
						</select>
					</div>
					<div className="formRow">
						<p className="formCell">Spec</p>
						<input
							value={rRule?.spec[0] || ''}
							type="number"
							onChange={e => setRRule(prev => ({
								...prev,
								spec: [e.target.value]
							}))}
							/>
					</div>
					<InteractiveTime type={'Effective Start'} parts={recurStartParts} setter={setRecurStartParts} />
					{recurEndParts ?
						<div className="formRow">
							<InteractiveTime type={'Effective End'} parts={recurEndParts} setter={setRecurEndParts} />
							<button className="relButton" onClick={() => setRecurEndParts(null)}>No End</button>
						</div>
						:
						<div className="formRow">
							<button className="relButton" onClick={() => setRecurEndParts(recurStartParts)}>Define End</button>
						</div>
					}
				</>
				: rRule.period &&
				<>
					<div className="formRow">
						<p className="formCell">
							{rRule.period}
						</p>
						<p className="sep">, </p>
						<p className="formCell">
							every {rRule.interval}
						</p>
						{rRule.period !== 'daily' &&
							<>
								<p className="sep">, </p>
								<p className="formCell">
									on {rRule.spec[0]}
								</p>
							</>
						}
						<p className="sep">, </p>
						<p className="formCell">
							@ {recurStartParts.hr}:{recurStartParts.min}
						</p>
					</div>
					<div className="formRow">
						<p className="formCell">
							Effective {recurStartParts.mo}/{recurStartParts.day}/{recurStartParts.yr}
						</p>
						<p className="sep"> - </p>
						<p className="formCell">
							Effective {recurEndParts.mo}/{recurEndParts.day}/{recurEndParts.yr}
						</p>
					</div>
				</>
			*/}

			{/* add field buttons */}
			{edit &&
				<div className="formRow">
					<button className="relButton" onClick={() => addField('text')}>
						Text Box
					</button>
					{/*
					<button className="relButton" onClick={() => addField('input')}>
						Input
					</button>
					<button className="relButton" onClick={() => addField('tf')}>
						T/F
					</button>
					*/}
					<button className="relButton" onClick={() => setForm({ ...form, includeStart: !form.includeStart })}>
						Add Start
					</button>
				</div>
			}

			{/* dynamic form fields */}
			{!edit &&
				event?.info?.map((f, idx) => (
					f.type === "text" &&
					<React.Fragment key={idx}>
						<p>{f.label}</p>
						<textarea
							className="formCell"
							placeholder="Notes etc..."
							value={f.content}
							onChange={e => changeField(idx, 'content', e.target.value)}
						/>
					</React.Fragment>
				))
			}

			{/* GOES BACK IN ABOVE
			form?.info?.map((f, idx) => (
				<div className="formRow" key={idx}>
					<input
						className="formCell"
						placeholder="Label..."
						value={f.label}
						onChange={e => changeField(idx, 'label', e.target.value)}
					/>
					<button className="relButton" onClick={() => deleteField(idx)}>
						×
					</button>
				</div>
				))
				:*/}

			{form?.includeStart && <InteractiveTime type={'Start'} parts={startParts} setter={setStartParts} />}
			<InteractiveTime type={form?.includeStart ? 'End' : 'Date/Time'} parts={endParts} setter={setEndParts} />

			<div className="submitRow right">
				{/*
				<button className="submitButton" onClick={() => {
					setEditRecur(!editRecur);
					setRRule(prev => ({ ...prev, update: true }));
					}}>
						{editRecur ? 'Done' : 'Schedule'}
				</button>
				<button className="submitButton" onClick={() => {
					setEdit(!edit);
					setForm(prev => ({ ...prev, update: true }));
					}}>
					{edit ? 'Done' : 'Edit Form'}
				</button>*/}
				<button className="submitButton" onClick={() => compositeUpdate(startParts, endParts, recurStartParts, recurEndParts)}>Save</button>
				<button className="submitButton add" onClick={() => setShowForm(null)}>-</button>
			</div>
		</div>
	)
};

const InteractiveTime = ({ type, parts, setter }) => {
	return (
		<div className="formRow">
			<p className='formCell sep'>{type}</p>
			{['mo', 'day', 'yr', 'hr', 'min'].map(key => {
				const maxLength = key === 'yr' ? 4 : 2;
				const class2 = key === 'yr' ? 'yr' : 'time';
				const after = (
					(key === 'mo' || key === 'day') ? '/'
						: (key === 'yr') ? '@'
						: (key === 'hr') ? ':'
						: 'EST'
				);
				return (
					<div className='formCell' key={key}>
						<input
							className={class2}
							placeholder={key.toUpperCase()}
							maxLength={maxLength}
							value={parts[key]}
							onChange={e => setter({ ...parts, [key]: e.target.value })}
							/>
						<p className="sep">{after}</p>
					</div>
				);
			})}
		</div>
	)
};

