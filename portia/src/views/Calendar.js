// views/Calendar.js

import React, { useState, useEffect, useMemo, useReducer } from 'react';
import { FiPlus, FiChevronsRight, FiChevronsLeft } from 'react-icons/fi';
import { useScreen } from '../contexts/ScreenContext';
import {
	returnDates,
	addTime,
	timeDiff,
	normDate,
	monthLength,
	dateTimeRange,
	weekdayAndDOTM,
} from '../helpers/DateTimeCalcs';
import { useCalendarDataHandler } from '../helpers/DataHandlers';
import {
	makeEmptyForm,
	makeEmptyEvent,
	makeEmptySchedule,
	initialCompositeState,
	updateComposite,
} from '../helpers/HandleComposite';
import { assignKeys } from '../helpers/Misc';
import { useSwipe } from '../helpers/DynamicView';
import { getDummyStyle, getDummyWithChildrenStyle } from '../helpers/Measure';
import { DropSelect } from '../components/Dropdown';
import { CompositeForm } from '../components/CompositeForm';
import { Floater } from '../components/Portal';

const colors = [
	"#b82323",
	"#bcc510",
	"#10c51c",
	"#10c5a4",
	"#107ac5",
	"#6e10c5",
	"#c510b0",
	"#c5108f",
	"#000000",
];

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
	const eventsMemo = useMemo(() => Object.fromEntries(events.map(e => [e._id, e])), [events]);
	const formsMemo = useMemo(() => Object.fromEntries(forms.map(f => [f._id, f])), [forms]);
	const recursMemo = useMemo(() => [ ...recurs ], [recurs]);
	const schedulesMemo = useMemo(() => [ ...schedules ], [schedules]);

	// Styling constants
	const eventDisplayPad = 4;
	const uniqueLeadingDirs = [ ...new Set(forms.map(f => f.path.split('/')[0])) ];
	const colorScheme = Object.fromEntries(
		uniqueLeadingDirs.map((lDir, idx) => {
			const color = colors[idx % (colors.length)];
			return [lDir, color];
		})
	);
	
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

				if (!newEvent.complete && newForm.includeStart) {
					newEvent.endStamp = new Date();
				}

				// None to many may be found
				let newSchedules = schedulesMemo.filter(sched => newEvent.path === sched.path);
				if (!newSchedules) {
					newSchedules = [makeEmptySchedule()];
				}

				reduceComposite({
					type: 'update',
					event: assignKeys(newEvent),
					form: assignKeys(newForm),
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

				console.log("Opening event:", assignKeys(newEvent), "\n form:", assignKeys(newForm))

				reduceComposite({
					type: 'update',
					event: assignKeys(newEvent),
					form: assignKeys(newForm),
					schedules: newSchedules,
				});
				return;
			}

			// Should never get here
			console.error("Selection doesn't match recur or event");
			reduceComposite({ type: 'reset' });
		}

	}, [showForm, eventsMemo, formsMemo, schedulesMemo, recursMemo]);

	// --- DATE HANDLERS -------------------------------------------------------
	const month = selectedDate.toLocaleString('default', { month: 'long' });

	// Create composite based on recur
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
			scheduleStart: recurClean.startStamp,
			info: newForm.info.map(f => {
				const { suggestions, ...cleanF } = f;
				return({ 
					...f,
					content: 
						f.type === 'input' ? (
							f.baseValue ? [f.baseValue] : ['']
						) 
						: f.type === 'text' ? (
							f.baseValue ? f.baseValue : ''
						) 
						: null
					});
			})
		};
		console.log("Creating from recur, event:", assignKeys(newEvent), "\n form:", assignKeys(newForm))
		reduceComposite({ type: 'set', event: assignKeys(newEvent), form: assignKeys(newForm), schedules: newScheds });
	};

	// Initialize empty form for event, form, sched
	const initEmptyComposite = (date) => {
		reduceComposite({ type: 'reset' });
		const clicked = new Date(date);
		const current = new Date();
		clicked.setHours(current.getHours(), current.getMinutes(), 0, 0);
		reduceComposite({ type: 'drill', path: ['event', 'endStamp'], value: clicked });
		reduceComposite({ type: 'drill', path: ['event', 'startStamp'], value: clicked });
		setShowForm({ _id: 'new' });
	}

	// Format events for display in dayCell
	const formatEvents = (date, isLarge) => {
		// Filter out resolved schedules
		const activeRecurs = recurs.filter(r => !events.some(e =>
			e.scheduleID === r.scheduleID
			&& new Date(e.scheduleStart).getTime() === new Date(r.startStamp).getTime()
		));
		const daysEvents = [...events, ...activeRecurs].filter(item =>
			(timeDiff(normDate(item.startStamp), date).days === 0)
			|| (new Date(item.startStamp) < date && new Date(item.endStamp) > date)
		).sort((a, b) =>
			new Date(a.startStamp) - new Date(b.startStamp)
		);

		// Get properties of relevant dummy elements for calculating absolute styles
		let dayContentSnapshot;
		let hourSpanWidth;
		if (smallScreen) {
			dayContentSnapshot = getDummyWithChildrenStyle(
				<div className="container">
					<div className={`calendar ${!leftExpanded ? 'expand' : ''}`}>
						<div className="dayView">
							<div className="dayCellLarge">
								<div className="dayContentLarge" id="dayContentLarge_target">
									<div className='hourSpan' id="hourSpanLarge_target">
										<div className="hourLine"/>
										<div id="time_target">00:00</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>,
				['height', 'width', 'padding-top', 'padding-left', 'padding-right', 'padding-bottom']
			);
			hourSpanWidth = Math.floor(dayContentSnapshot?.hourSpanLarge?.width + dayContentSnapshot?.hourSpanLarge?.paddingLeft);
		} else {
			dayContentSnapshot = getDummyWithChildrenStyle(
				<div className="container">
					<div className={`calendar ${!leftExpanded ? 'expand' : ''}`}>
						<div className="dayView">
							<div className="dayCellSmall" />
							<div className="dayCellSmall"> 
								<div className="dayContentSmall" id="dayContentSmall_target">
									<div className='hourSpan' id="hourSpanSmall_target">
										<div className="hourLine" />
										<div>00:00</div>
									</div>
								</div>
							</div>
							<div className="dayCellLarge">
								<div className="dayContentLarge" id="dayContentLarge_target">
									<div className='hourSpan' id="hourSpanLarge_target">
										<div className="hourLine" />
										<div id="time_target">00:00</div>
									</div>
								</div>
							</div>
							<div className="dayCellSmall" />
							<div className="dayCellSmall" />
						</div>
					</div>
				</div>,
				['height', 'width', 'padding-top', 'padding-left', 'padding-right', 'padding-bottom']
			);
			if (isLarge) {
				hourSpanWidth = Math.floor(dayContentSnapshot?.hourSpanLarge?.width + dayContentSnapshot?.hourSpanLarge?.paddingLeft);
			} else {
				hourSpanWidth = Math.floor(dayContentSnapshot?.hourSpanSmall?.width + dayContentSnapshot?.hourSpanSmall?.paddingLeft);
			}
		}
		const hourHeight = Math.ceil(dayContentSnapshot?.hourSpanLarge?.height + dayContentSnapshot?.hourSpanLarge?.paddingTop + dayContentSnapshot?.hourSpanLarge?.paddingBottom);
		const timeWidth = Math.ceil(dayContentSnapshot?.time?.width + dayContentSnapshot?.time?.paddingLeft + dayContentSnapshot?.time?.paddingRight);
		const eventStyle = getDummyWithChildrenStyle(
			<div className="eventRow formRow" id="eventRow_target">
				<button className="relButton">
					Sometext
				</button>
			</div>,
			['height']
		);
		const titleHeight = Math.ceil(eventStyle?.eventRow?.height);

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

		// Accumulate the necessary formatting info for each event/recur
		const formatting = [];
		let potLeftOverlaps = [];
		let potRightOverlaps = [];
		for (const item of daysEvents) {
			const start = new Date(item.startStamp);
			const end = new Date(item.endStamp);

			const onRight = item?.isRecur || item.complete === 'pending';

			let indents;
			if (onRight) {
				potRightOverlaps = potRightOverlaps.filter((potR) => (potR.startStamp <= item.startStamp && potR.endStamp > item.startStamp)) // If starts before and ends during/after
				potRightOverlaps.push({ startStamp: item.startStamp, endStamp: item.endStamp });
				indents = potRightOverlaps.length;
			} else {
				potLeftOverlaps = potLeftOverlaps.filter((potL) => (potL.startStamp <= item.startStamp && potL.endStamp > item.startStamp)) // If starts before and ends during/after
				potLeftOverlaps.push({ startStamp: item.startStamp, endStamp: item.endStamp });
				indents = potLeftOverlaps.length;
			}

			const topMembers = hourMembers[start.getHours()];
			const topMemberSkips = topMembers.filter(mem =>
				(mem.start < item.startStamp)
				|| (timeDiff(mem.start, item.startStamp).minutes === 0 && mem.path < item.path)
			).length;
			const hourTop = hourFormatting[start.getHours()].top + hourHeight / 2;
			const topHourHeight = topMembers.length > 0 ? titleHeight * topMembers.length : hourHeight
			const lineTop = hourTop + (start.getMinutes() / 60) * topHourHeight;
			const rowTop = hourTop + topMemberSkips * titleHeight;

			const bottomMembers = hourMembers[end.getHours()];
			const hourBottom = hourFormatting[end.getHours()].top + hourHeight / 2;
			const bottomHourHeight = bottomMembers.length > 0 ? titleHeight * bottomMembers.length : hourHeight;
			const lineBottom = hourBottom + (end.getMinutes() / 60) * bottomHourHeight;

			const translateLine = onRight ? -(eventDisplayPad * indents + timeWidth) : eventDisplayPad * indents;
			const translateRow = onRight ? translateLine - 2 * eventDisplayPad : translateLine + 2 * eventDisplayPad;
			const rowWidth = onRight ? translateRow - hourSpanWidth : hourSpanWidth - translateRow;

			const line = {
				top: lineTop + 'px',
				height: `${lineBottom - lineTop}px`,
				transform: 'translateX(' + translateLine + 'px)'
			}
			if (onRight) {
				line.right = '0';
			}
			const row = {
				top: rowTop + 'px',
				transform: 'translateX(' + translateRow + 'px)',
				width: rowWidth + 'px'
			}

			//console.log('line', line);
			formatting.push({ row, line });
		}

		return { daysEvents, formatting, colorScheme, hourFormatting }
	}

	return (
		<React.Fragment>
			{/** Calendar Navigation */}
			<div className="navigationBar">
				{!smallScreen && <FiChevronsLeft className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { days: -3 }), 'day')}/>}
				<button className="navButton" onClick={() => onDayClick(selectedDate, 'month')}>{month}</button>
				{!smallScreen && <FiChevronsRight className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { days: 3 }), 'day')}/>}
			</div>
			<div className="dayView">
				{days.map((date, idx) => {
					const isLarge = smallScreen ? true : (idx === 2);
					const { daysEvents, formatting, colorScheme, hourFormatting } = formatEvents(date, isLarge);
					return (
						<div key={date.getTime()} id={date.toISOString()} className={isLarge ? 'dayCellLarge' : 'dayCellSmall'}>
							<div
								className={isLarge ? 'dayTitleLarge' : 'dayTitleSmall'}
								onClick={() => timeDiff(selectedDate, date).days !== 0 && onDayClick(date, 'day')}
								>
								<span>{weekdayAndDOTM(date)}</span>
								<FiPlus className="relButton" onClick={() => initEmptyComposite(date)} />
							</div>
							<div className={isLarge ? 'dayContentLarge' : 'dayContentSmall'}>
								{hourFormatting.map((fmt, hr) =>
									<div key={hr} className='hourSpan' style={fmt}>
										<div className='hourLine'/>
										<div>{String(hr).padStart(2,'0')}:00</div>
									</div>
								)}
								{daysEvents.map((item, jdx) => {
									const lineStyle = { ...formatting[jdx].line, '--line-color': colorScheme[item.path.split('/')[0]] };
									const onRight = item?.isRecur || item.complete === 'pending';
									const baseClass = `${onRight ? 'recur' : 'event'}`;
									return (
										<React.Fragment key={item._id}>
											<span className={`${baseClass}Span`} style={lineStyle} />
											<div className={`${baseClass}Row formRow`} style={formatting[jdx].row}>
												{onRight && <p className="sep">{dateTimeRange(item.startStamp, item.endStamp)}</p> }
												<button className="relButton" style={{ borderWidth: '2px', borderColor: colorScheme[item.path.split('/')[0]] }}
													onClick={() => {
														if (item.isRecur) {
															createCompositeFromRecur(item);
															setShowForm({ _id: 'new' }); // click recur case
														} else {
															setShowForm({ _id: item._id }); // click event case
														}
													}}
													>
													{item.path.split('/')[item.path.split('/').length - 1]}
												</button>
												{!onRight && <p className="sep">{dateTimeRange(item.startStamp, item.endStamp)}</p> }
											</div>
										</React.Fragment>
									);
								})}
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
		</React.Fragment>
	);
};

