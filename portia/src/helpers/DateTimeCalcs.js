import { refEqual } from 'firebase/firestore';
import { RRule, rrulestr } from 'rrule';

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
}

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
	if (addend.seconds) {
		date.setMinutes(date.getMinutes() + addend.minutes);
	}

	return date;
};

/**
 * Find time diff as whole num
 */
export const timeDiff = (date1, date2) => {
	// Make sure date1 is always the later date
	if (!date1 || !date2){
		return { days: null, months: null, years: null, hours: null, minutes: null };
	}

	if (date1 < date2) {
		[date1, date2] = [date2, date1];
	}

	let years = date1.getFullYear() - date2.getFullYear();
	let months = date1.getMonth() - date2.getMonth();
	let days = date1.getDate() - date2.getDate();
	let hours = date1.getHours() - date2.getHours();
	let minutes = date1.getMinutes() - date2.getMinutes();

	if (minutes < 0) {
		minutes += 60;
		hours -= 1;
	}

	if (hours < 0) {
		hours += 24;
		days -= 1;
	}

	if (days < 0) {
		const prevMonth = new Date(date1.getFullYear(), date1.getMonth(), 0); // Last day of prev month
		days += prevMonth.getDate(); // Get days in prev month
		months -= 1;
	}

	if (months < 0) {
		months += 12;
		years -= 1;
	}

	return {
		years,
		months,
		days,
		hours,
		minutes,
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
export const normDate = (date) => {
	const normedDate = new Date(date);
	normedDate.setHours(0, 0, 0, 0);
	return normedDate;
}

/** Return the correct dates based on the view */
export const returnDates = (baseDate, view) => {
	const centeredDate = normDate(baseDate);
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

// #region ---- DATE/TIME FORMAT CONVERTERS --------------------------------

// Convert js date to parts for user editing
export const editFriendlyDateTime = (date) => {
	if (!date) { 
		const now = new Date();
		return {
			year: String(now.getFullYear()),
			month: String(now.getMonth()),
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
}

// Clamp value between min and max
export const clamp = (v, min, max) => Math.min(Math.max(min, max), Math.max(min, v));

// Convert parts to js date
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
}

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
}

// #endregion


// #region ---- RRULE CALCS --------------------------------------------------

// By first index and 2nd: 0->1 or 1->0
const period2rRule = [
	['daily', RRule.DAILY],
	['weekly', RRule.WEEKLY],
	['monthly', RRule.MONTHLY],
	['yearly', RRule.YEARLY],
]
// By index
const weekday2rRule = [RRule.SU, RRule.MO, RRule.TU,RRule.WE, RRule.TH, RRule.FR,RRule.SA]

/**
 * RRule string to RRule
 * @param {*} rRuleStr 
 * @returns 
 */
export const rRuleStrToRRule = (rRuleStr) => {
	return rrulestr(rRuleStr);
}

/**
 * RRule to editable object
 * @param {*} rRule 
 * @returns 
 */
export const rRuleToObj = (rRule) => {
	console.log("RRule in: ", rRule);
	const op = rRule.origOptions || rRule.options

	const period = period2rRule.find(([p, rP]) => rP === op.freq)[0] || 'daily';
	const interval = op.interval || 1;

	let spec = []
	if (op.byweekday) {
		spec = op.byweekday.map(rDay => weekday2rRule.findIndex(w => w.weekday === rDay.weekday));
	} else if (op.bymonthday) {
		spec = op.bymonthday;
	} else if (op.bymonth) {
		spec = op.bymonth;
	}

	return { period, interval, spec };
}


/**
 * Editable obj -> RRule string
 * @param {*} obj 
 * @returns 
 */
export const objToRRule = (obj) => {
	const options = {
		freq: period2rRule.find(([p, rP]) => p === obj.period)[1] || RRule.DAILY,
		interval: obj.interval || 1,
		dtstart: obj.startStamp
	};
	if (obj.period === 'weekly') {
		options.byweekday = obj.spec.map(i => weekday2rRule[i]);
	} else if (obj.period === 'monthly') {
		options.bymonthday = obj.spec;
	} else if (obj.period === 'yearly') {
		options.bymonth = obj.spec;
	}

	return new RRule(options);
}


/**
 * Inclusively? gets all occurances of rrule in provided period
 * @param {*} rRule 
 * @param {Date} start 
 * @param {Date} end 
 * @returns
 */
export const getOccurances = (rRule, start, end) => {
	const { dtstart, ...restOpts } = rRule.options;
	const adjStart = rRule.before(start, true) || dtstart;
	const adjRRule = new RRule({ ...restOpts, dtstart: adjStart });
	return adjRRule.between(start, end, true);
}

// #endregion