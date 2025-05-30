import React from 'react';


/**
 * Confirm input validity
 * @param {*} value 
 * @param {Array} allowedTypes 
 * @returns {bool} 
 */
export const TypeCheck = (value, allowedTypes) => {
	// Notify if allowed types is not accepted structure
	if (!Array.isArray(allowedTypes)) {
		console.error('Allowed Types should be an array.\n', allowedTypes);
		return false;
	}

	// Get type of value and delegate accordingly
	const type = Array.isArray(value) ? 'array' : typeof value

	return allowedTypes.includes(type);
}
