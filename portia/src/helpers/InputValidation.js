const tzCheck = (value) => {
	try {
		new Intl.DateTimeFormat([], { timeZone: value });
		return { valid: true, err: null };
	} catch {
		return { valid: false, err: 'Unexpected error in timezone' };
	}
}

const pathCheck = (value) => {
	if (value.endsWith('/')) { return { valid: false, err: 'Trailing slash not permitted' } } 
	else { return { valid: true, err: null } }
}

const numberCheck = (value) => {
	if (typeof value === 'number' && Number.isFinite(value)) { return { valid: true, err: null } }
	else { return { valid: false, err: 'Not a numeric value' } }
}

const falseToTest = (value) => {
	return { valid: false, err: 'Test error'};
}

// Recursively check type validity of objects before storage
// Objects check nested values based on keys 
// Arrays check each value for specified check
const buildTypeValidity = (keys, value, allowedTypes, overallState) => {
	// Record location of check
	const path = keys.join('->') || 'root';
	//console.log(`Checking ${path} for`, allowedTypes);
	// allowed types is (non-array) object until checking types
	const type = 
		value === null ? 'null' :
		value instanceof Date ? 'date' :
		Array.isArray(value) ? 'array' :
		typeof value;
	//console.log(`Current value ${type}: `, value);

	if (type === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(
				([key, val]) => [key, buildTypeValidity([ ...keys, key], val, allowedTypes[key], overallState)]
			)
		);
	} else if (type === 'array') {
		return value.map((val, idx) => buildTypeValidity([ ...keys, idx], val, allowedTypes, overallState));
	} else {
		let errMsg = '';
		let matchedType = false; // AT LEAST one type check must be matched
		let passedCustomChecks = true; // Function checks MUST BE PASSED
		for (const check of allowedTypes) {

			if (typeof check === 'string') {
				if (check === type || check === 'any') {
					matchedType = true;
					continue;
				}
			}

			if (typeof check === 'function') {
				const result = check(value);
				if (!result?.valid) {
					passedCustomChecks = false;
					errMsg += result.err;
				}
			}

		}

		if (!matchedType) {
			errMsg += `${path} contains invalid type: ${type}. `
		}

		if (!matchedType || !passedCustomChecks) {
			overallState.valid = false;
			return { valid: false, err: errMsg };
		} else {
			return { valid: true, err: null };
		}
	}

}

export const validateForm = (form) => {

	const allowedTypes = {
		_id: ['null', 'string'],
		ownerID: ['undefined', 'string'],
		includeStart: ['boolean'],
		path: ['string', pathCheck],
		info: {
			label: ['string'],
			type: ['string'],
			placeholder: ['string'],
			baseValue: ['string', 'boolean'],
			suggestions: ['string'],
			options: ['string'],
		},
	}

	const overall = { valid: true };
	const validity = buildTypeValidity([], form, allowedTypes, overall);
	return { isValid: overall.valid, validity };
}

export const validateEvent = (event) => {

	const allowedTypes = {
		_id: ['null', 'string'],
		ownerID: ['undefined', 'string'],
		formID: ['null', 'string'],
		scheduleID: ['null', 'string'],
		path: ['string', pathCheck],
		scheduleStart: ['null', 'date'],
		info: {
			content: ['string', 'boolean'],
			label: ['string'],
			type: ['string'],
			options: ['string'],
			placeholder: ['string'],
			suggestions: ['string'],
		},
		complete: ['boolean'],
		startStamp: ['date'],
		endStamp: ['date'],
	}
	const overall = { valid: true };
	const validity = buildTypeValidity([], event, allowedTypes, overall);
	return { isValid: overall.valid, validity };
}

export const validateSchedule = (sched) => {

	const allowedTypes = {
		_id: ['null', 'string'],
		ownerID: ['undefined', 'string'],
		formID: ['null', 'string'],
		path: ['string', pathCheck],
		startStamp: ['date'],
		endStamp: ['date'],
		period: ['string'],
		interval: ['number', numberCheck],
		until: ['undefined', 'date'],
		tz: ['any', tzCheck],
	}

	const overall = { valid: true };
	const validity = buildTypeValidity([], sched, allowedTypes, overall);
	return { isValid: overall.valid, validity};
}

