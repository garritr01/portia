export const addTime = (jsDate, addend) => {
	/**
	 * jsDate - js Date Object
	 * addend - add unit to jsDate { days: 0, months: 0, years: 0, hours: 0, seconds: 0 } }
	 * returns resulting js Date Object
	 */
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

export const getDayOfWeek = (date, getInt = true) => {
	if (getInt) {
		return date.getDay();
	} else {
		const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		return daysOfWeek[date.getDay()];
	}
};

export const normDate = (date) => {
	const normedDate = new Date(date);
	normedDate.setHours(0, 0, 0, 0);
	return normedDate;
}
