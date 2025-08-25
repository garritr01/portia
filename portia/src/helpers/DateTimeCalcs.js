import { useState, useMemo, useEffect } from 'react';
import { RRule } from 'rrule';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { parseISO } from 'date-fns';
import { clamp } from './Misc';
import { clone } from 'rrule/dist/esm/dateutil';

// Define keys that contain datetimes requiring format adjustment
const timeStampKeys = ['startStamp', 'endStamp', 'until'];
// Define options for scheduling
export const periodOptions = [
	{ display: 'No Schedule', value: null, altDisplay: "None but this shouldn't appear" },
	{ display: 'No Repeat', value: 'single', altDisplay: "Just once" },
	{ display: 'Daily', value: 'daily', altDisplay: "day" },
	{ display: 'Weekly', value: 'weekly', altDisplay: "week" },
	{ display: 'Monthly', value: 'monthly', altDisplay: "month" },
	{ display: 'Annually', value: 'yearly', altDisplay: "year" },
];
export const weekdayOptions = [
	{ display: "Sunday", value: 0 },
	{ display: "Monday", value: 1 },
	{ display: "Tuesday", value: 2 },
	{ display: "Wednesday", value: 3 },
	{ display: "Thursday", value: 4 },
	{ display: "Friday", value: 5 },
	{ display: "Saturday", value: 6 }
];
export const monthOptions = [
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

// #region Define TZ information

const ZONE_NAMES = (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []);
const TZ_COUNT = ZONE_NAMES.length;
const getLocalTZ = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

/** Compute { strOffset, numOffset } for each time zone */
const getTzOffset = (tz, baseDate = new Date()) => {
	let dateStr, match, hr, min;
	try {
		dateStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).format(baseDate);
		match = dateStr.match(/GMT([+-]\d{1,2}):?(\d{2})?$/);
		hr = parseInt(match[1], 10);
		min = parseInt(match[2] ?? '0', 10);
		return { strOffset: `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`, numOffset: hr + (min / 60) };
	} catch (error) {
		//console.warn(
		//	`Error calculating ${tz} offset:`, error,
		//	`\n Using dateStr: ${dateStr}, match: ${match?.[0] ?? []}, hr: ${hr}, min: ${min}`
		//);
		return { strOffset: '', numOffset: undefined };
	}
};

/** Compute { display, value, numOffset} for each time zone */
const getTzInfo = (baseDate = new Date()) => {
	const tzInfo = ZONE_NAMES.map(tz => {
		const { strOffset, numOffset } = getTzOffset(tz, baseDate);
		return {
			display: `${tz} ${strOffset}`,
			value: tz,
			numOffset
		};
	}).filter(tz =>
		Number.isFinite(tz?.numOffset)
	);
	
	if (tzInfo.length < (0.8 * TZ_COUNT)) {
		console.warn(`${TZ_COUNT - tzInfo.length} of ${TZ_COUNT} are undefined.`);
	}

	return tzInfo;
};

/** Compute local time zone and dependents on change (timer based trigger) */
export const useTZ = (pollMin = 0.1) => {
	const pollingInterval = Math.floor(pollMin * 60000); // ms
	const [localTZ, setLocalTZ] = useState(() => getLocalTZ());

	useEffect(() => {
		const intervalID = setInterval(() => {
				const newTZ = getLocalTZ();
				setLocalTZ(prev => (prev !== newTZ ? newTZ : prev));
			}, 
			pollingInterval
		);

		return () => clearInterval(intervalID);
	}, [pollingInterval]);

	const { localOffset, tzOptions } = useMemo(() => {
		const now = new Date();
		const localOffset = getTzOffset(localTZ, now)?.numOffset ?? 0;

		const tzOptions = getTzInfo(now).sort((a, b) => {
			const diffA = a.numOffset - localOffset;
			const diffB = b.numOffset - localOffset;
			const wrappedA = diffA >= 0 ? diffA : 24 + diffA;
			const wrappedB = diffB >= 0 ? diffB : 24 + diffB;
			return wrappedA - wrappedB || a.value.localeCompare(b.value);
		}).map(opt => 
			({ value: opt.value, display: opt.display })
		);

		return { localOffset, tzOptions };
	}, [localTZ]);

	return { localTZ, localOffset, tzOptions };
};

// #endregion

/* Sort checklist on load */
export const sortChecklist = (checklist) => {
	// Sort by priority or last update
	return checklist.sort((a, b) => {
		// 1. by priority 
		if (a.priority !== b.priority) {
			return b.priority - a.priority // descending order
		}
		// 2. by last update, earlier (less recent) first
		return new Date(a.updatedAt) - new Date(b.updatedAt);
	});
};

// #region Datetime Warnings

export const normedCheck = (date) => {
	if (date.getHours() || date.getMinutes() || date.getSeconds() || date.getMilliseconds()) {
		console.warn("Non-normed selection: ", date);
	}
}

// #endregion

// #region Misc Time Operations

const msPerMin = 60000;
const msPerHr = 60 * msPerMin;
const msPerDay = 24 * msPerHr;

/**
 * - jsDate - js Date
 * - addend - add unit { days: 0, months: 0, years: 0, hours: 0, seconds: 0 }
 * - returns dict of units w diff
 */
export const addTime = (jsDate, addend) => {
	const date = new Date(jsDate);

	if (addend.years) {
		date.setFullYear(date.getFullYear() + addend.years);
	}
	if (addend.months) {
		date.setMonth(date.getMonth() + addend.months);
	}
	if (addend.days) {
		date.setDate(date.getDate() + addend.days);
	}
	if (addend.hours) {
		date.setHours(date.getHours() + addend.hours);
	}
	if (addend.minutes) {
		date.setMinutes(date.getMinutes() + addend.minutes);
	}

	return date;
};

/**
 * whole number time difference (rounded down) for years, months, days, hours, minutes 
 * @param {Date} date1 
 * @param {Date} date2 
 */
export const timeDiff = (date1, date2, inUTC = false) => {
	if (!date1 || !date2){
		return { days: null, months: null, years: null, hours: null, minutes: null };
	}

	const msDiff = date1.getTime() - date2.getTime();
	const monthDiff = inUTC ? date1.getMonth() - date2.getMonth() : date1.getUTCMonth() - date2.getUTCMonth();
	const yearDiff = inUTC ? date1.getFullYear() - date2.getFullYear() : date1.getUTCFullYear() - date2.getUTCFullYear();

	if (msDiff % msPerMin !== 0) {
		console.warn(`Detected remainder of ${msDiff % msPerMin}ms in: ${date1} - ${date2}`)
	}

	return {
		years: yearDiff,
		months: monthDiff,
		days: Math.floor(msDiff / msPerDay),
		hours: Math.floor(msDiff / msPerHr),
		minutes: Math.floor(msDiff / msPerMin),
	};
};

/** Get day of week as string (or int) */
export const getDayOfWeek = (date, getName = true) => {
	const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	// Return name of day if given integer
	if (Number.isInteger(date) && date >= 0 && date <= 6) { return daysOfWeek[date] }
	// Return int or name of day if given js Date object
	else if (date instanceof Date) {
		if (getName) {
			return daysOfWeek[date.getDay()];
		} else {
			return date.getDay();
		}
	} else {
		console.error("Must getDayOfWeek from int (0-6) or js Date Obj:", date);
		return null;
	}
};

/** Return the length of the month the date is in */
export const monthLength = (date) => {
	const year = date.getFullYear();
	const month = date.getMonth();
	return new Date(year, month + 1, 0).getDate();
};

/** 'Normalize' date to midnight */
export const normDate = (date, UTC = false) => {
	const normedDate = new Date(date);
	UTC ? normedDate.setUTCHours(0, 0, 0, 0) : normedDate.setHours(0, 0, 0, 0);
	return normedDate;
};

/** Return the normalized dates required to define the calendar view */
export const defineCalendarDates = (baseDate, view) => {
	const centeredDate = normDate(baseDate);
	console.log(baseDate, centeredDate);
	let dates = [];

	if (view === 'year') {
		// 12 months, each first day
		for (let month = 0; month < 12; month++) {
			dates.push(new Date(centeredDate.getFullYear(), month, 1));
		}
		return dates;
	}

	if (view === 'month') {
		// Start at Sunday before the 1st of the month
		const firstOfMonth = new Date(centeredDate.getFullYear(), centeredDate.getMonth(), 1);
		const firstDayOfWeek = getDayOfWeek(firstOfMonth);
		const start = addTime(firstOfMonth, { days: -firstDayOfWeek });

		for (let i = 0; i < 42; i++) { // 6 weeks × 7 days
			dates.push(addTime(start, { days: i }));
		}
		return dates;
	}

	if (view === 'day') {
		// 5 days centered around
		for (let offset = -2; offset <= 2; offset++) {
			dates.push(addTime(centeredDate, { days: offset }));
		}
		return dates;
	}


	return [];
};

/** Find the holes in cached dates that have to be filled for complete startDate and endDate range */
export const defFetchRanges = (startDate, endDate, cachedDates, mergeTolerance = 2, chunkTolerance = 10) => {

	// Get ranges corrseponding to holes in cache
	const createRanges = () => {
		let ranges = [];
		let currStart;
		let currDate = new Date(startDate);
		while (currDate < endDate) {
			normedCheck(currDate);
			if (!currStart && !(cachedDates.has(currDate.getTime()))) { 
				currStart = currDate; // Set start of a range when start is falsy and currDate not in cache
			} else if (currStart && (cachedDates.has(currDate.getTime()))) { 
				// Push a new range when currStart is truthy and currDate is in cache, then clear currDate
				ranges.push({
					start: currStart,
					end: currDate
				});
				currStart = null;
			}
			currDate = addTime(currDate, { days: 1 }); // Increment by a day
		}

		normedCheck(currDate);
		if (currStart) {
			ranges.push({
				start: currStart,
				end: currDate
			})
		}
		return ranges;
	};

	// Merge nearby ranges
	const mergeRanges = (ranges) => ranges.reduce((acc, r) => {
		if (acc.length === 0) { acc.push({ ...r }) }
		else {
			const last = acc[acc.length - 1];
			const gap = timeDiff(r.start, last.end).days;
			if (gap <= mergeTolerance) { last.end = r.end }
			else { acc.push({ ...r })}
		}
		return acc;
	}, []);

	// Enforce max chunk size
	const chunkRanges = (ranges) => ranges.flatMap((r) => {
		const chunks = [];
		let s = clone(r.start);
		while (timeDiff(s, r.end) > chunkTolerance) {
			const e = addTime(s, { days: chunkTolerance });
			chunks.push({ start: clone(s), end: clone(e) });
		}
		chunks.push({ start: clone(s), end: clone(r.end) });
		return chunks;
	});

	const holes = createRanges();
	if (holes.length === 0) { return [] }
	const merged = mergeRanges(holes);
	const chunked = chunkRanges(merged);

	return chunked;
};

/** Find all midnights in range [start, end) */
export const dayTicksBetween = (start, end, includeLast = false) => {
	const lastBase = normDate(end, false).getTime();
	const last = includeLast ? lastBase + 1 : lastBase;
	const out = new Set();
	for (let t = normDate(start, false).getTime(); t < last; t += msPerDay) { out.add(t) }
	return out;
};

// #endregion

// #region ---- DATE/TIME FORMAT CONVERTERS --------------------------------

/* Convert predefined keys to Date objects */
export const ISOsToDates = (obj) => {
	return Object.fromEntries(
		Object.entries(obj).map(([k, v]) =>
			timeStampKeys.includes(k) && v
				? [k, parseISO(v)]
				: [k, v]
		)
	);
};

/** Convert predefined keys to ISOStrings */
export const DatesToISOs = (obj) => {
	return Object.fromEntries(
		Object.entries(obj).map(([k, v]) =>
			timeStampKeys.includes(k) && v
				? [k, v.toISOString()]
				: [k, v]
		)
	);
};

// Convert js date to parts for user editing
export const editFriendlyDateTime = (date) => {
	if (!date) { 
		const now = new Date();
		return {
			year: String(now.getFullYear()),
			month: String(now.getMonth() + 1),
			day: String(now.getDate()),
			hour: String(now.getHours()),
			minute: String(now.getMinutes()),
			weekday: String(getDayOfWeek(now, false))
		}
	}
	return {
		year: String(date.getFullYear()),
		month: String(date.getMonth() + 1),
		day: String(date.getDate()),
		hour: String(date.getHours()),
		minute: String(date.getMinutes()),
		weekday: String(getDayOfWeek(date, false)),
	}
};

// Convert parts to js date4e4
export const calcFriendlyDateTime = (unit, baseDate, updatedParts) => {
	if (!baseDate || !updatedParts) { return null };
	// parse or fallback to current date part
	const parsed = parseInt(updatedParts[unit], 10);
	let upDate = new Date(baseDate);
	// preliminary apply year/month so day clamp is correct
	if (unit === 'year') upDate.setFullYear(parsed || baseDate.getFullYear())
	if (unit === 'month') upDate.setMonth((parsed || baseDate.getMonth()))
	// compute dynamic days-in-month
	const monthLen = monthLength(upDate)
	// clamp the final value
	let final;
	switch (unit) {
		case 'year': final = clamp(parsed, 0, 9999); break
		case 'month': final = clamp(parsed, 0, 11); break
		case 'day': final = clamp(parsed, 1, monthLen); break
		case 'hour': final = clamp(parsed, 0, 23); break
		case 'minute': final = clamp(parsed, 0, 59); break
		case 'weekday': final = clamp(parsed, 0, 6); break
		default: {
			console.warn("Unexpected unit in calcFriendlyDateTime:\n", unit, ' :', parsed);
			final = (parsed || 0);
		}
	}

	// apply it
	if (unit === 'year') { upDate.setFullYear(final) }
	else if (unit === 'month') { upDate.setMonth(final) }
	else if (unit === 'day') { upDate.setDate(final) }
	else if (unit === 'hour') { upDate.setHours(final) }
	else if (unit === 'minute') { upDate.setMinutes(final) }
	else if (unit === 'weekday') {
		const prevWeekday = getDayOfWeek(baseDate, false);
		const newWeekday = updatedParts.weekday;
		const diff = newWeekday - prevWeekday;
		upDate = addTime(baseDate, { days: diff });
	}

	return upDate;
};

// Convert js date to string for display
export const viewFriendlyDateTime = (date, includeTZ = false) => {
	if (!date) { return '' }
	return date.toLocaleString(undefined, {
		weekday: 'short',
		year: 'numeric',   // “2025”
		month: 'short',     // “Apr”
		day: 'numeric',   // “5”
		hour: 'numeric',   // “3 PM” or “15”
		minute: '2-digit',   // “03:05”
		...(includeTZ ? { timeZoneName: 'short' } : {})      // “EDT”, “GMT+1”, etc.
	});
};

// For displaying range of time
export const dateTimeRange = (start, end) => {
	const startString = new Date(start).toLocaleString('default', { hour: "2-digit", minute: "2-digit", hour12: false });
	if (start.getTime() === end.getTime()) { return startString };
	const endString = new Date(end).toLocaleString('default', { hour: "2-digit", minute: "2-digit", hour12: false });
	return `${startString}-${endString}`;
};

// For displaying weekday and day of month
export const weekdayAndDOTM = (date) => {
	const weekday = date.toLocaleDateString('default', { weekday: 'short' });
	const dotm = date.toLocaleDateString('default', { day: 'numeric' });
	return `${weekday}\u00A0${dotm}`;
};

// #endregion


// #region ---- RRULE CALCS --------------------------------------------------

// Return RRule period by obj period string
const period2rRule = {
	'daily': RRule.DAILY,
	'weekly': RRule.WEEKLY,
	'monthly': RRule.MONTHLY,
	'yearly': RRule.YEARLY,
};
// Return RRule style day of the week by index
const weekday2rRule = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

/**
 * Get all occurances of schedules between startDate and endDate 
 * @param {Array} schedules
 * @param {Date} start
 * @param {Date} lastDayMidnight
 * @returns
*/
export const getAllRecurs = (schedules, startLocal, lastDayMidnightLocal, localTZ) => {
	const startUTC = fromZonedTime(startLocal, localTZ);
	const endLocal = addTime(lastDayMidnightLocal, { 'days': 1 });
	const endUTC = fromZonedTime(endLocal, localTZ);
	// Filter out schedules that cannot appear within this range... keep (not expired && starts in/before calendar window)
	const filteredSchedules = schedules.filter((sched) => (!sched.until || !(sched.until < startUTC)) && !(sched.startStamp > endUTC));
	// Flat map each schedule to get the recurs
	return filteredSchedules.flatMap(sched => {
		if (sched.period === 'single') {
			return [makeSingleRecur(sched)];
		} else {
			const rule = objToRRule(sched, localTZ); // Turn schedule object into RRule
			const occurs = getOccurances(rule, startUTC, endUTC, localTZ); // Get occurances of RRule within calendar range
			if (sched.path.endsWith('test')) { console.log("test sched:", sched,"\nrule:", rule, "\noccurs:", occurs) }
			return occurs.map(recur => makeMultiRecur(sched, recur));
		}
	});
};

/**
 * Editable obj -> RRule obj
 * @param {*} obj 
 * @returns {RRule}
 */
const objToRRule = (obj, localTZ) => {
	const tz = obj.tz || localTZ;
	const dtStart = fromZonedTime(obj.startStamp, tz);
	const until = obj.until ? fromZonedTime(obj.until, tz) : undefined;

	const options = {
		freq: period2rRule[obj.period] || RRule.DAILY,
		interval: obj.interval || 1,
		dtstart: dtStart,
		until: until,
		byhour: [dtStart.getUTCHours()],
		byminute: [dtStart.getUTCMinutes()]
	};

	if (obj.period === 'weekly') {
		options.byweekday = [weekday2rRule[dtStart.getUTCDay()]];
	} else if (obj.period === 'monthly') {
		options.bymonthday = [dtStart.getUTCDate()];
	} else if (obj.period === 'yearly') {
		options.bymonth = [dtStart.getUTCMonth() + 1];
	}

	return new RRule(options);
};


/**
 * Inclusively? gets all occurances of rrule in provided period
 * @param {*} rRule 
 * @param {Date} start 
 * @param {Date} end 
 * @returns
 */
const getOccurances = (rRule, start, end, localTZ) => {
	let { dtstart, ...restOpts } = rRule.options;
	dtstart = rRule.before(start, true) || dtstart;
	const adjRRule = new RRule({ ...restOpts, dtstart });
	const occursUTC = adjRRule.between(start, end, true);
	return occursUTC.map(d => toZonedTime(d, localTZ));
};

/** Make 'single' schedule occurance into recur */
const makeSingleRecur = (sched) => ({
	_id: `${sched._id}_${sched.startStamp.toISOString()}`,
	scheduleID: sched._id,
	path: sched.path,
	startStamp: sched.startStamp,
	endStamp: sched.endStamp,
	isRecur: true,
	tz: sched.tz
});

/** Make repeating schedule occurance into recur */
const makeMultiRecur = (sched, recur) => ({
	_id: `${sched._id}_${recur.toISOString()}`,
	scheduleID: sched._id,
	path: sched.path,
	startStamp: recur,
	endStamp: addTime(recur, timeDiff(sched.endStamp, sched.startStamp)),
	isRecur: true,
	tz: sched.tz
});

// #endregion