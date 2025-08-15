// views/Calendar.js

import React, { useState, useEffect, useMemo, useReducer } from 'react';
import { FiPlus, FiChevronsRight, FiChevronsLeft } from 'react-icons/fi';
import {
	returnDates,
	addTime,
	timeDiff,
	normDate,
	dateTimeRange,
	weekdayAndDOTM,
} from '../helpers/DateTimeCalcs';
import { useCalendarDataHandler } from '../helpers/DataHandlers';
import {
	initialCompositeState,
	updateComposite,
	initEmptyComposite,
	createCompositeFromRecur,
	createCompositeFromEvent,
} from '../helpers/HandleComposite';
import { assignKeys } from '../helpers/Misc';
import { typeCheck } from '../helpers/InputValidation';
import { useSwipe, useSmallScreen, useWindowSize } from '../helpers/DynamicView';
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

const useCalendarMeasurements = ({ smallScreen, leftExpanded }) => {

};

export const DayView = ({
	selectedDate, // Date which range is based on
	days,
	onDayClick, // Could change span or just selected date, always changes range and causes update
	leftExpanded, // For formatting
}) => {

	// --- SCREEN SIZE HANDLERS -------------------------------------------------------
	const smallScreen = useSmallScreen() || false;
	// Switch days via swipe
	useSwipe({
		onSwipeLeft: smallScreen && !leftExpanded ? () => onDayClick(addTime(selectedDate, { days: 1 }), 'day') : null,
		onSwipeRight: smallScreen && !leftExpanded ? () => onDayClick(addTime(selectedDate, { days: -1 }), 'day') : null,
	});

	// --- EVENT/FORM/RECUR HANDLERS --------------------------------------------------
	const [composite, reduceComposite] = useReducer(updateComposite, initialCompositeState);
	const [showForm, setShowForm] = useState(false);
	// autofill/empty form/event/recur based 'showForm' value (_id, 'new', or null)
	// Memos so useEffect doesn't depend on everything
	const { upsertComposite, events, forms, schedules, recurs } = useCalendarDataHandler(days[0], days[days.length - 1], reduceComposite);

	// Styling constants
	const eventDisplayPad = 8;
	const uniqueLeadingDirs = [...new Set(forms.map(f => f.path.split('/')[0]))];
	const colorScheme = Object.fromEntries(
		uniqueLeadingDirs.map((lDir, idx) => {
			const color = colors[idx % (colors.length)];
			return [lDir, color];
		})
	);

	// --- DATE HANDLERS -------------------------------------------------------
	const month = selectedDate.toLocaleString('default', { month: 'long' });

	/**
	 * For use within sorter to sort events containing (by priority)
	 * - 'startStamp' - chronologically earlier first
	 * - 'endStamp' - chronologically earlier first
	 * - 'path' - alphabetically earlier first
	 * - '_id' - alphabetically earlier first
	 * @param {*} a
	 * @param {*} b 
	 * @returns {{ sorter:number }}
	 */
	const sortEvents = (a, b) => {

		// Skip if ordering will fail
		let skip = false;
		const necessaryKeys = [
			['startStamp', Date],
			['endStamp', Date],
			['path', 'string'],
			['_id', 'string'],
		];

		for (const [k, t] of necessaryKeys) {
			if (!(k in a)) { skip = true; console.warn(`${k} missing for sorter in:\n`, a); }
			else if (!typeCheck(a[k], t)) { skip = true; console.warn(`${k} has invalid type in:\n`, a); }
			if (!(k in b)) { skip = true; console.warn(`${k} missing for sorter in:\n`, b); }
			else if (!typeCheck(b[k], t)) { skip = true; console.warn(`${k} has invalid type in:\n`, b); }
		} if (skip) {
			console.warn("Skipping logical ordering");
			return 0;
		}

		// Sort chronologically by startStamp (earlier first) unless 0
		const startsBefore = a.startStamp - b.startStamp;
		if (startsBefore) { return startsBefore }

		// Sort chronologically by endStamp (later first) unless 0
		const endsBefore = a.endStamp - b.endStamp;
		if (endsBefore) { return endsBefore }

		// Sort alphabetically by path (earlier first) unless same
		const pathAlphaBefore = a.path.localeCompare(b.path);
		if (pathAlphaBefore) { return pathAlphaBefore }

		// Sort alphabetically by _id (earlier first) always different
		return a._id.localeCompare(b._id);
	}

	/**
	 * Filter out potential overlaps that do not end after item starts, and finds smallest open slot
		 * @param {Array<{ endStamp: Date, slot: number }>} pOvers
		 * @param {{ startStamp: Date }} item
		 * @returns {{ slot: number, pOvers: Array<{ endStamp: Date, slot: number }>}}
		 */
	const slotEvents = (pOvers, item) => {

		// Filter out potentialOverlaps that end at or before current item starts
		pOvers = pOvers.filter(p => p.endStamp > item.startStamp);

		// Find smallest slot that is not occupied
		const occupied = new Set(pOvers.map(o => o.slot));
		let slot = 1;
		while (occupied.has(slot)) { slot += 1 }

		// Add item (with slot) to potential overlaps
		pOvers.push({
			endStamp: item.endStamp,
			slot,
		})

		return { slot, pOvers };
	}

	// Format events for display in dayCell
	const formatEvents = (date, isLarge) => {
		// Filter out resolved schedules
		const activeRecurs = recurs.filter(r => !events.some(e =>
			e.scheduleID === r.scheduleID
			&& new Date(e.scheduleStart).getTime() === new Date(r.startStamp).getTime()
		));

		// Get all events that overlap the current date
		const daysEvents = [...events, ...activeRecurs].filter(item =>
			(timeDiff(normDate(item.startStamp), date).days === 0)
			|| (item.startStamp < date && item.endStamp > date)
		).sort((a, b) => sortEvents(a, b));
		const overlapEvents = daysEvents.filter(e => e.startStamp < date).map(e => ({ start: e.startStamp, end: e.endStamp, path: e.path, _id: e._id }));

		// #region MEASURE DUMMIES
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
										<div className="hourLine" />
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
		// #endregion

		// #region HOUR FORMATTING

		// Accumulate members of each hour (used for ordering)
		const hourMembers = Array.from({ length: 24 }, () => []);
		const startInDayEvents = daysEvents.filter(e => e.startStamp >= date); // Exclude items that start before date
		// Add each event's sort-relevant properties to its respective hour
		for (const e of startInDayEvents) {
			const hour = e.startStamp.getHours();
			hourMembers[hour].push({
				startStamp: e.startStamp,
				endStamp: e.endStamp,
				path: e.path,
				_id: e._id
			});
		}

		// Accumulate necessary formatting info for each hour label (top, height)
		let prevMemberHeight = overlapEvents.length * titleHeight;
		const hourFormatting = [{ top: prevMemberHeight }];
		for (let hr = 0; hr < 24; hr++) {
			const prevHrHeight = (hr + 1) * hourHeight; // Increment by 1 to account for 00:00
			const numMem = hourMembers[hr].length; // Get number of hourMembers within each hour
			prevMemberHeight += numMem > 0 ? numMem * titleHeight - hourHeight : 0; // Accumulate height of members preceding each hour
			hourFormatting.push({ top: prevHrHeight + prevMemberHeight, height: hourHeight }); // Define properties by hour
		}
		// #endregion

		// #region EVENT FORMATTING
		// Accumulate the necessary formatting info for each event/recurin a parallel array
		const formatting = [];
		let potentialOverlaps = { left: [], right: [] };
		for (const item of daysEvents) {
			const start = item.startStamp;
			const end = item.endStamp;

			// Bools for whether even extends beyond date
			const startsBefore = start < date;
			const continuesAfter = end > addTime(date, { days: 1 });

			// Recurs and pending events on right, rest on left
			const onRight = item?.isRecur || item.complete === 'pending';

			// #region VERTICAL PROPS
			// #region TOP PROPS
			// Get all members that start within the same hour as the current item (use overlaps if starts before date)
			const topMembers = startsBefore ? overlapEvents : hourMembers[start.getHours()];
			// Accumulate count of hour members that are ordered to be before current item
			const topMemberSkips = topMembers.reduce((acc, mem) => acc + (sortEvents(mem, item) < 0 ? 1 : 0), 0);
			// Get current hour top property for basing formatting (0 if before day starts, otherwise use middle of hour)
			const hourTop = startsBefore ? 0 : hourFormatting[start.getHours()].top + hourHeight / 2;
			// Calculate height of hour w/ all included events
			const topHourHeight = topMembers.length > 0 ? titleHeight * topMembers.length : hourHeight;
			// Calculate location of top of line
			const lineTop = startsBefore ? hourTop : hourTop + (start.getMinutes() / 60) * topHourHeight;
			// Calculate location of button
			const rowTop = hourTop + topMemberSkips * titleHeight;
			// #endregion

			// #region BOTTOM PROPS
			// Get all members that start within the same hour as the current item ENDS (use 23:00 if ends later than date)
			const bottomMembers = continuesAfter ? hourMembers[23] : hourMembers[end.getHours()];
			// Get current hour top property for basing formatting (24:00 + hourHeight if after day ends, otherwise use middle of hour)
			const hourBottom = continuesAfter ? hourFormatting[24].top + hourHeight : hourFormatting[end.getHours()].top + hourHeight / 2;
			// Calculate height of hour w/ all included events
			const bottomHourHeight = bottomMembers.length > 0 ? titleHeight * bottomMembers.length : hourHeight;
			// Calculate location of bottom of line
			const lineBottom = hourBottom + (end.getMinutes() / 60) * bottomHourHeight;
			// #endregion
			// #endregion

			// #region HORIZONTAL PROPERTIES
			// Find the smallest indent where the current item will not overlap and remove any future impossible overlaps
			const sideKey = onRight ? 'right' : 'left';
			const { slot: indents, pOvers } = slotEvents(potentialOverlaps[sideKey], item);
			potentialOverlaps[sideKey] = pOvers;

			// Calculate translations to account for indents
			const translateLine = onRight ? -(eventDisplayPad * indents + timeWidth) : eventDisplayPad * indents;
			const translateRow = onRight ? translateLine - eventDisplayPad : translateLine + eventDisplayPad;
			const rowWidth = onRight ? translateRow - hourSpanWidth : hourSpanWidth - translateRow;
			// #endregion

			// Define line properties
			const line = {
				top: lineTop + 'px',
				height: `${lineBottom - lineTop}px`,
				transform: 'translateX(' + translateLine + 'px)'
			}
			// Align to right if onRight
			if (onRight) {
				line.right = '0';
			}
			// Define row properties
			const row = {
				top: rowTop + 'px',
				transform: 'translateX(' + translateRow + 'px)',
				width: rowWidth + 'px'
			}

			formatting.push({ row, line });
		}
		// #endregion

		return { daysEvents, formatting, hourFormatting };
	}

	return (
		<React.Fragment>
			{/** Calendar Navigation */}
			<div className="navigationBar">
				{!smallScreen && <FiChevronsLeft className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { days: -3 }), 'day')} />}
				<button className="navButton" onClick={() => onDayClick(selectedDate, 'month')}>{month}</button>
				{!smallScreen && <FiChevronsRight className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { days: 3 }), 'day')} />}
			</div>
			<div className="dayView">
				{days.map((date, idx) => {
					const isLarge = smallScreen ? true : (idx === 2);
					const { daysEvents, formatting, hourFormatting } = formatEvents(date, isLarge);
					return (
						<div key={date.getTime()} id={date.toISOString()} className={isLarge ? 'dayCellLarge' : 'dayCellSmall'}>
							<div
								className={isLarge ? 'dayTitleLarge' : 'dayTitleSmall'}
								onClick={() => timeDiff(selectedDate, date).days !== 0 && onDayClick(date, 'day')}
							>
								<span>{weekdayAndDOTM(date)}</span>
								<FiPlus className="relButton" onClick={() => {
									initEmptyComposite(date, reduceComposite);
									setShowForm(true);
								}} />
							</div>
							<div className={isLarge ? 'dayContentLarge' : 'dayContentSmall'}>
								{hourFormatting.map((fmt, hr) =>
									<div key={hr} className='hourSpan' style={fmt}>
										<div className='hourLine' />
										<div>{String(hr % 24).padStart(2, '0')}:00</div>
									</div>
								)}
								{daysEvents.map((item, jdx) => {
									const lineStyle = { ...formatting[jdx].line, '--line-color': colorScheme[item.path.split('/')[0]] };
									const onRight = item?.isRecur || item.complete === 'pending';
									const baseClass = `${onRight ? 'recur' : 'event'}`;
									const pointIndicator = [
										item.startStamp < date && 'noBefore',
										item.endStamp >= addTime(date, { days: 1 }) && 'noAfter',
									].filter(Boolean).join(' ');
									return (
										<React.Fragment key={item._id}>
											<span className={`${baseClass}Span ${pointIndicator}`} style={lineStyle} />
											<div className={`${baseClass}Row formRow`} style={formatting[jdx].row}>
												{onRight && (
													<p className="sep">{dateTimeRange(item.startStamp, item.endStamp)}</p>
												)}
												<button className="relButton" style={{ borderWidth: '2px', borderColor: colorScheme[item.path.split('/')[0]] }}
													onClick={() => {
														if (item.isRecur) {
															createCompositeFromRecur(item, forms, schedules, reduceComposite);
														} else {
															createCompositeFromEvent(item, forms, schedules, reduceComposite);
														}
														setShowForm(true);
													}}
												>
													{item.path.split('/')[item.path.split('/').length - 1]}
												</button>
												{!onRight && (
													item?.complete === 'skipped' ?
														<p className="sep">Skipped</p>
														: <p className="sep">{dateTimeRange(item.startStamp, item.endStamp)}</p>
												)}
											</div>
										</React.Fragment>
									);
								})}
							</div>
						</div>
					)
				})}
				{showForm &&
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

