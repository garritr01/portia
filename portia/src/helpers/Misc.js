import { v4 as uuid } from 'uuid';

export const toCamel = (prop) => prop.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

export const assignKeys = (obj) => {

	if (obj instanceof Date) {
		return obj;
	} else if (Array.isArray(obj)) {
		return obj.map(item => assignKeys(item));
	} else if (obj && typeof obj === 'object') {
		let copy = { ...obj };

		// Transform any option and content arrays to contain uuids
		if (copy?.type === 'mc' && Array.isArray(copy.options)) {
			copy.options = copy.options.map(opt => !opt?.key ? ({ key: uuid(), value: opt }) : opt);
		} else if (copy?.type === 'input' && Array.isArray(copy.content)) {
			copy.content = copy.content.map(val => !val?.key ? ({ key: uuid(), value: val }) : val);
		}

		// Recurse into object
		for (const k in copy) { copy[k] = assignKeys(copy[k]) }
		return copy;
	} else {
		return obj;
	}

}

export const dropKeys = (obj) => {

	if (obj instanceof Date) {
		return obj;
	} else if (Array.isArray(obj)) {
		return obj.map(item => dropKeys(item));
	} else if (obj && typeof obj === 'object') {
		let copy = { ...obj };

		if ('key' in copy && 'value' in copy) {
			return dropKeys(obj.value);
		}

		// Recurse into object
		for (const k in copy) { copy[k] = dropKeys(copy[k]) }
		return copy;
	} else {
		return obj;
	}

}