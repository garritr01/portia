import { RRule, rrulestr } from 'rrule';

/**
 * - jsDate - js Date
 * - addend - add unit { days: 0, months: 0, years: 0, hours: 0, seconds: 0 } }
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
		date.setSeconds(date.getSeconds() + addend.seconds);
	}

	return date;
}

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

/** Get day of week as int */
export const getDayOfWeek = (date, getInt = true) => {
	if (getInt) {
		return date.getDay();
	} else {
		const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		return daysOfWeek[date.getDay()];
	}
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

/** Return the length of the month the date is in */
export const monthLength = (date) => {
	const year = date.getFullYear();
	const month = date.getMonth();
	return new Date(year, month + 1, 0).getDate();
}

export const makeSafeDate = ({yr, mo, day, hr, min}) => {
	const dt = new Date(yr, mo - 1, day, hr, min);
	return new Date(dt.getTime());
}

export const makeDateParts = (date) => {

	const yr = date.getFullYear()
	const mo = date.getMonth()
	const day = date.getDate()
	const hr = date.getHours()
	const min = date.getMinutes()

	const round = new Date(yr, mo, day, hr, min)
	if (
		round.getFullYear() !== date.getFullYear() ||
		round.getMonth() !== date.getMonth() ||
		round.getDate() !== date.getDate() ||
		round.getHours() !== date.getHours() ||
		round.getMinutes() !== date.getMinutes()
	) {
		throw new Error('Date cannot round-trip (e.g. DST gap)')
	}

	return { yr, mo: mo + 1, day, hr, min }
}


// --- RRULE CALCS -----------------------------------------------------------------------

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
export const rRuleToObject = (rRule) => {
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
export const objectToRRuleString = (obj) => {
	console.log("Obj in", obj);
	const op = {
		freq: period2rRule.find(([p, rP]) => p === obj.period)[1] || RRule.DAILY,
		interval: obj.interval || 1,
	};
	console.log("2")
	if (obj.spec) {
		if (obj.period === 'weekly') {
			op.byweekday = obj.spec.map(i => weekday2rRule[i]);
		} else if (obj.period === 'monthly') {
			op.bymonthday = obj.spec;
		} else if (obj.period === 'yearly') {
			op.bymonth = obj.spec;
		}
	}
	console.log("RRule out: ", RRule.optionsToString(op));

	return RRule.optionsToString(op)
}


/**
 * Inclusively? gets all occurances of rrule in provided period
 * @param {*} rRule 
 * @param {Date} start 
 * @param {Date} end 
 * @returns
 */
export const getOccurances = (rRule, start, end) => {
	return rRule.between(start, end, true);
}