// helpers/InputValidation.js

const infoAllowed = {
	'mc': ['null', 'string'],
	'tf': ['null', 'boolean'],
	'input': ['string'],
	'text': ['string']
}

const tzCheck = (value, valueTypePlaceholder, contentTypePlaceholder) => {
	try {
		new Intl.DateTimeFormat([], { timeZone: value });
		return { valid: true, err: null };
	} catch {
		return { valid: false, err: 'Unexpected error in timezone' };
	}
}

const pathCheck = (value, valueTypePlaceholder, contentTypePlaceholder) => {
	if (value.endsWith('/')) { return { valid: false, err: 'Trailing slash not permitted' } } 
	else { return { valid: true, err: null } }
}

const numberCheck = (value, valueTypePlaceholder, contentTypePlaceholder) => {
	if (typeof value === 'number' && Number.isFinite(value)) { return { valid: true, err: null } }
	else { return { valid: false, err: 'Not a numeric value' } }
}

const contentCheck = (value, valueType, contentType) => {
	if (infoAllowed[contentType].includes(valueType)) {
		return { valid: true, err: null }
	} else {
		return { valid: false, err: `${contentType} content is invalid type: (${valueType})${value}`}
	}
}

const baseValueCheck = (value, valueType, contentType) => {
	if (contentType === 'text') { 
		if (!value) {
			return { valid: true, err: null }
		} else {
			return { valid: false, err: `Base value should not be present in ${contentType}`}
		}
	} else if (infoAllowed[contentType].includes(valueType)) {
		return { valid: true, err: null }
	} else {
		return { valid: false, err: `${contentType} base value is invalid type: (${valueType})${value}` }
	}
}

const suggestionsCheck = (value, valueType, contentType) => {
	if (contentType !== 'input') {
		return { valid: false, err: `Suggestions should not be present in ${contentType}`}
	} else if (infoAllowed[contentType].includes(valueType)) {
		return { valid: true, err: null }
	} else {
		return { valid: false, err: `${contentType} suggestion is invalid type: (${valueType})${value}` }
	}
}

const optionsCheck = (value, valueType, contentType) => {
	if (contentType !== 'mc') {
		return { valid: false, err: `Options should not be present in ${contentType}` }
	} else if (infoAllowed[contentType].includes(valueType)) {
		return { valid: true, err: null }
	} else {
		return { valid: false, err: `${contentType} option is invalid type: (${valueType})${value}` }
	}
}

const falseToTest = (value, placeholder) => {
	return { valid: false, err: 'Test error'};
}

/**
 * Check that the value is the accepted type. 
 * 	Specified for: string, number, Date
 * @param {*} value 
 * @param {*} valueType 
 * @returns 
 */
export const typeCheck = (value, valueType) => 
	valueType === 'string' ? (typeof value === 'string') :
	valueType === 'number' ? (typeof value === 'number') :
	valueType === Date ? (value instanceof Date) :
	(value instanceof valueType);

// Recursively check type validity of objects before storage
// Objects check nested values based on keys 
// Arrays check each value for specified check
const buildTypeValidity = (keys, value, allowedTypes, overallState, contentType = null) => {

	// Ignore these while migration hasn't dropped old values
	const lastKey = keys.length > 0 ? keys[keys.length - 1] : null;
	if (typeof lastKey === 'string' && (lastKey.endsWith('_orig') || lastKey.endsWith('_new'))) { return }

	// Record location of check
	const path = keys.join('->') || 'root';
	//console.log(`Checking ${path} for`, allowedTypes, '\nContains: ', value);
	// infoAllowed types is (non-array) object until checking types
	const type = 
		value === null ? 'null' :
		value instanceof Date ? 'date' :
		Array.isArray(value) ? 'array' :
		typeof value;
	//console.log(`Current value ${type}: `, value);

	if (type === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(
				([key, val]) => [key, buildTypeValidity([ ...keys, key], val, allowedTypes[key], overallState, contentType)]
			)
		);
	} else if (type === 'array') {
		if (lastKey === 'info') {
			return value.map((val, idx) => buildTypeValidity([ ...keys, idx], val, allowedTypes, overallState, val.type));
		} else {
			return value.map((val, idx) => buildTypeValidity([...keys, idx], val, allowedTypes, overallState, contentType));
		}
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
				const result = check(value, type, contentType);
				if (!result?.valid) {
					passedCustomChecks = false;
					errMsg += result.err;
				}
			}

		}

		if (!matchedType) {
			errMsg += `${path} contains invalid value: (${type}) ${value}. `
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
			baseValue: ['any', baseValueCheck],
			suggestions: ['any', suggestionsCheck],
			options: ['any', optionsCheck],
		},
	}

	const overall = { valid: true };
	try {
		const validity = buildTypeValidity([], form, allowedTypes, overall);
		return { isValid: overall.valid, validity };
	} catch (err) {
		console.error("Error building form validity:", err, form);
	}
}

export const validateEvent = (event) => {

	const allowedTypes = {
		_id: ['null', 'string'],
		ownerID: ['undefined', 'string'],
		scheduleID: ['null', 'string'],
		completionID: ['null', 'string'],
		path: ['string', pathCheck],
		info: {
			content: ['any', contentCheck],
			label: ['string'],
			type: ['string'],
		},
		complete: ['string'],
		startStamp: ['date'],
		endStamp: ['date'],
	}

	const overall = { valid: true };
	try {
		const validity = buildTypeValidity([], event, allowedTypes, overall);
		return { isValid: overall.valid, validity };
	} catch (err) {
		console.error("Error building event validity:", err, event);
	}
}

export const validateSchedule = (sched) => {

	const allowedTypes = {
		_id: ['null', 'string'],
		ownerID: ['undefined', 'string'],
		path: ['string', pathCheck],
		startStamp: ['date'],
		endStamp: ['date'],
		until: ['null', 'date'],
		period: ['string'],
		interval: ['number', numberCheck],
		tz: ['any', tzCheck],
	}

	const overall = { valid: true };
	try {
		const validity = buildTypeValidity([], sched, allowedTypes, overall);
		return { isValid: overall.valid, validity};
	} catch (err) {
		console.error("Error building schedule validity:", err, sched);
	}
}

