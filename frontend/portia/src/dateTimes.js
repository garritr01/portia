/**
 * - jsDate - js Date Object
 * - addend - add unit to jsDate { days: 0, months: 0, years: 0, hours: 0, seconds: 0 } }
 * - returns resulting js Date Object
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
 * Done such that adding the results iteratively (largest units to smallest) will reconstruct date1.
 * - date1, date2 - JS Date objects
 * - Returns absolute difference as { days, months, years, hours, seconds }
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

	// Adjust for negative differences (e.g., if month or day is negative)
	if (minutes < 0) {
		minutes += 60;
		hours -= 1;
	}

	if (hours < 0) {
		hours += 24;
		days -= 1;
	}

	if (days < 0) {
		const prevMonth = new Date(date1.getFullYear(), date1.getMonth(), 0); // Last day of the previous month
		days += prevMonth.getDate(); // Get the number of days in the previous month
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

/** Get day of week, defaults to integer return value */
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
		console.log("year returning: ", dates);
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

/**
 * Ensure each numeric part is in range and normalize month → 0‑based.
 * Throws on any invalid input.
 */
export function validateDateParts({ year, month, day, hour, minute }) {
	const y = parseInt(year, 10);
	const m = parseInt(month, 10);
	const d = parseInt(day, 10);
	const h = parseInt(hour, 10);
	const min = parseInt(minute, 10);

	if (!(y >= 1)) throw new Error("Year must be ≥ 1");
	if (!(m >= 1 && m <= 12)) throw new Error("Month must be 1–12");
	const daysInMonth = new Date(y, m, 0).getDate();
	if (!(d >= 1 && d <= daysInMonth)) throw new Error(`Day must be 1–${daysInMonth}`);
	if (!(h >= 0 && h <= 23)) throw new Error("Hour must be 0–23");
	if (!(min >= 0 && min <= 59)) throw new Error("Minute must be 0–59");

	// Return normalized parts: month index 0–11
	return { y, m: m - 1, d, h, min };
}

/**
 * Build JS date from parts, watching for rollover and DST
 */
export function makeSafeDate(parts) {
	const { y, m, d, h, min } = validateDateParts(parts);
	const dt = new Date(y, m, d, h, min);
	if (
		dt.getFullYear() !== y ||
		dt.getMonth() !== m ||
		dt.getDate() !== d ||
		dt.getHours() !== h ||
		dt.getMinutes() !== min
	) {
		throw new Error("Invalid local time (e.g. DST gap)");
	}

	return dt;
}
