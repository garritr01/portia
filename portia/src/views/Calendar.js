// views/Calendar.js

import React, { useState, useEffect, useMemo, useReducer } from 'react';
import { FiPlus, FiChevronsRight, FiChevronsLeft } from 'react-icons/fi';
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
import { useCalendarDataHandler } from '../helpers/DataHandlers';
import {
	makeEmptyForm,
	makeEmptyEvent,
	makeEmptySchedule,
	initialCompositeState,
	updateComposite,
} from '../helpers/HandleComposite';
import { useSwipe } from '../helpers/DynamicView';
import { getDummyStyle, getDummyWithChildrenStyle } from '../helpers/Measure';
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
		selectedDate, // Date which range is based on
		days, 
		onDayClick, // Could change span or just selected date, always changes range and causes update
		leftExpanded, // For formatting
	}) => {
	
	// --- SCREEN SIZE HANDLERS -------------------------------------------------------
	const { smallScreen = false } = useScreen() || {};
	// Switch days via swipe
	useSwipe({
		onSwipeLeft: smallScreen && !leftExpanded ? () => onDayClick(addTime(selectedDate, { days: 1 }), 'day') : null,
		onSwipeRight: smallScreen && !leftExpanded ? () => onDayClick(addTime(selectedDate, { days: -1 }), 'day') : null,
	});

	// --- EVENT/FORM/RECUR HANDLERS --------------------------------------------------
	const [composite, reduceComposite] = useReducer(updateComposite, initialCompositeState);
	const [showForm, setShowForm] = useState({ _id: null });
	// autofill/empty form/event/recur based 'showForm' value (_id, 'new', or null)
	// Memos so useEffect doesn't depend on everything
	const { upsertComposite, events, forms, schedules, recurs } = useCalendarDataHandler(days[0], days[days.length - 1], setShowForm);
	//useEffect(() => console.log('events', events), [events]);
	//useEffect(() => console.log('forms', forms), [forms]);
	//useEffect(() => console.log('schedules', schedules), [schedules]);
	//useEffect(() => console.log('recurs', recurs), [recurs]);
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

	const createCompositeFromRecur = (recur) => {
		const { isRecur, ...recurClean } = recur;
		const newScheds = schedules.filter(s => s.path === recurClean.path);
		let newForm = forms.find(f => f._id === newScheds[0].formID);
		if (!newForm.includeStart && new Date(recurClean.startStamp).getTime() !== new Date(recurClean.endStamp).getTime()) {
			newForm = { ...newForm, includeStart: true }
		}
		let newEvent = { 
			...makeEmptyEvent(), 
			...recurClean,
			_id: null,
			formID: newForm._id,
			scheduleID: recurClean._id,
			scheduleStart: recurClean.startStamp,
			info: newForm.info.map(f => ({
				...f,
				content: 
					f.type === 'input' ? (
						f.baseValue ? [f.baseValue] : ['']
					) 
					: f.type === 'text' ? (
						f.baseValue ? f.baseValue : ''
					) 
					: null
			}))
		};
		reduceComposite({ type: 'set', event: newEvent, form: newForm, schedules: newScheds });
	};

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
					<FiChevronsLeft className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { days: -3 }), 'day')}/>
					<button className="navButton" onClick={() => onDayClick(selectedDate, 'month')}>{month}</button>
					<FiChevronsRight className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { days: 3 }), 'day')}/>
				</div>
			}
			<div className="dayView">
				{days.map((date, idx) => {
					// Filter out resolved schedules
					const activeRecurs = recurs.filter(r =>!events.some(e => 
						e.scheduleID === r._id 
						&& new Date(e.scheduleStart).getTime() === new Date(r.startStamp).getTime()
					));
					const daysEvents = [ ...events, ...activeRecurs ].filter(item => 
						(timeDiff(normDate(item.startStamp), date).days === 0)
						|| (new Date(item.startStamp) < date && new Date(item.endStamp) > date)
					).sort((a, b) => 
						new Date(a.startStamp) - new Date(b.startStamp)
					);

					const hourSpanSnapshot = getDummyWithChildrenStyle(
						<div className='hourSpan' id="hourSpan_target">
							<div id="time_target">00:00</div>
						</div>, 
						['height', 'width', 'padding-top', 'padding-left', 'padding-right', 'padding-bottom']
					);
					const hourHeight = Math.ceil(hourSpanSnapshot?.hourSpan?.height + hourSpanSnapshot?.hourSpan?.paddingTop + hourSpanSnapshot?.hourSpan?.paddingBottom);
					const timeWidth = Math.ceil(hourSpanSnapshot?.time?.width + hourSpanSnapshot?.time?.paddingLeft + hourSpanSnapshot?.time?.paddingRight);
					const eventStyle = getDummyWithChildrenStyle(
						<div className="eventRow formRow" id="eventRow_target">
							<button className="relButton">
								Sometext
							</button>
						</div>,
						['height']
					);
					const titleHeight = Math.ceil(eventStyle?.eventRow?.height);
					//console.log('hH', hourHeight);
					//console.log('tH', titleHeight);

					// Accumulate the number of events in each hour
					const overlapMembers = daysEvents.filter(e => new Date(e.startStamp) < date);
					const hourMembers = Array.from({ length: 24 }, () => []);
					for (const e of daysEvents.filter(e => !(new Date(e.startStamp) < date))) {
						const start = new Date(e.startStamp);
						const hour = start.getHours();
						hourMembers[hour].push({ start, path: e.path });
					}

					// Accumulate necessary formatting info for each hour label
					let prevMemberHeight = overlapMembers.length * titleHeight;
					const hourFormatting = [{ top: prevMemberHeight }];
					for (let hr = 0; hr < 24; hr++) {
						const prevHrHeight = (hr + 1) * hourHeight;
						const numMem = hourMembers[hr].length;
						prevMemberHeight += numMem > 0 ? numMem * titleHeight - hourHeight : 0;
						hourFormatting.push({ top: prevHrHeight + prevMemberHeight, height: hourHeight });
					}

					if (date.getDate() === 20) {console.log(hourFormatting)}
					
					// Accumulate the necessary formatting info for each event/recur
					const formatting = [];
					let potOverlaps = [];
					for (const item of daysEvents) {
						const start = new Date(item.startStamp);
						const end = new Date(item.endStamp);
						
						const overlapping = potOverlaps.some(e => e > start);
						const indents = overlapping ? potOverlaps.length : 0;
						if (!overlapping) { potOverlaps = [] }
						potOverlaps.push(end);

						const topMembers = hourMembers[start.getHours()];
						const topMemberSkips = topMembers.filter(mem =>
							(mem.start < item.startStamp)
							|| (timeDiff(mem.start, item.startStamp).minutes === 0 && mem.path < item.path)
						).length;
						const hourTop = hourFormatting[start.getHours()].top + hourHeight/2;
						const topHourHeight = topMembers.length > 0 ? titleHeight * topMembers.length : hourHeight
						const lineTop = hourTop + (start.getMinutes() / 60) * topHourHeight;
						const rowTop = hourTop + topMemberSkips * titleHeight;
						//console.log('titleHeightPadded', titleHeight)

						const bottomMembers = hourMembers[end.getHours()];
						const hourBottom = hourFormatting[end.getHours()].top + hourHeight/2;
						const bottomHourHeight = bottomMembers.length > 0 ? titleHeight * bottomMembers.length : hourHeight;
						const lineBottom = hourBottom + (end.getMinutes() / 60) * bottomHourHeight;

						//console.log(date, item.path, '\ntopMembers:', topMembers, '\ntopMemberSkips:', topMemberSkips, '\nhourTop:', hourTop, '\nlineTop:', lineTop, '\nrowTop:', rowTop, '\nbottomMembers:', bottomMembers, '\nhourBottom:', hourBottom, '\nlineBottom:', lineBottom);

						const translateLine = (item?.isRecur || !item?.complete) ? -(8 * indents + timeWidth) : 8 * indents;
						const translateRow = (item?.isRecur || !item?.complete) ? translateLine -8 : translateLine + 8;
						//if (item.path.endsWith('drugs')) { console.log(translateX, '= -8 * ', indents, ' + ', eventStyle?.eventSpan?.paddingRight, ' + ', timeWidth) }
						
						const line = { 
							top: lineTop + 'px', 
							height: `${Math.max(lineBottom - lineTop, 4)}px`, 
							transform: 'translateX(' + translateLine + 'px)' 
						}
						if (item?.isRecur || !item?.complete) {
							line.right = '0';
						}
						const row = { 
							top: rowTop + 'px', 
							transform: 'translateX(' + translateRow + 'px)' 
						}

						//console.log('line', line);
						formatting.push({ row, line });
					}

					return (
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
								{hourFormatting.map((fmt, hr) =>
									<div className='hourSpan' style={fmt}>
										<div className='hourLine'/>
										<div>{hr}:00</div>
									</div>
								)}
								{daysEvents.map((item, jdx) => 
									<React.Fragment>
										<span key={`${idx}-${jdx}`} 
											className={`${(item?.isRecur || !item.complete) ? 'recurSpan' : 'eventSpan'}`} 
											style={formatting[jdx].line}
										/>
										<div className={`${(item?.isRecur || !item.complete) ? 'recurRow' : 'eventRow'} formRow`} style={formatting[jdx].row}>
											{(item?.isRecur || !item?.complete) &&
												<p className="sep">
													{new Date(item.startStamp).toLocaleString('default', { hour: "2-digit", minute: "2-digit", hour12: false })}
													-
													{new Date(item.endStamp).toLocaleString('default', { hour: "2-digit", minute: "2-digit", hour12: false })}
												</p>
											}
											<button className="relButton" onClick={() => {
												if (item.isRecur) {
													createCompositeFromRecur(item);
													setShowForm({ _id: 'new' }); // click recur case
												} else {
													setShowForm({ _id: item._id }); // click event case
												}
											}}>
												{item.path.split('/')[item.path.split('/').length - 1]}
											</button>
											{(!item?.isRecur && item?.complete) &&
												<p className="sep">
													{new Date(item.startStamp).toLocaleString('default', { hour: "2-digit", minute: "2-digit", hour12: false })}
													-
													{new Date(item.endStamp).toLocaleString('default', { hour: "2-digit", minute: "2-digit", hour12: false })}
												</p>
											}
										</div>
									</React.Fragment>
								)}
								<FiPlus className="createButton" onClick={() => {
									reduceComposite({ type: 'reset' });
									const clicked = new Date(date);
									const current = new Date();
									clicked.setHours(current.getHours(), current.getMinutes(), 0, 0);
									reduceComposite({ type: 'drill', path: ['event', 'endStamp'], value: clicked });
									reduceComposite({ type: 'drill', path: ['event', 'startStamp'], value: clicked });
									setShowForm({ _id: 'new' });
								}}/>
							</div>
						</div>
					)
				})}
				{showForm._id &&
					<Floater>
						<CompositeForm
							allForms={forms}
							allSchedules={schedules}
							composite={composite} 
							reduceComposite={reduceComposite}
							setShowForm={setShowForm}
							upsertComposite={upsertComposite}
						/>
					</Floater>
				}
			</div>
		</>
	);
};

