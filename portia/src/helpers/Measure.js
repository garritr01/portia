import { toCamel } from './Misc';

/* Create pseudo-element for any measuring */
export const getDummyStyle = (text, className, snapshotStyles) => {
	const dummy = document.createElement('div');
	dummy.className = className;
	dummy.textContent = text;
	document.body.appendChild(dummy);
	const live = window.getComputedStyle(dummy);
	const style = {};
	for (const prop of snapshotStyles) {
		const propVal = live.getPropertyValue(prop);
		style[toCamel(prop)] = propVal.endsWith('px') ? propVal.slice(0, -2) : propVal
	}
	document.body.removeChild(dummy);
	return style;
};

/* Get width of element based on text, padding and border */
export const measureTextWidth = (text, style) => {

	const parseFloatFallback = (str) => {
		const n = parseFloat(str);
		if (Number.isFinite(n)) {
			return n;
		} else {
			console.warn(`Non-finite meaurement in element with text: ${text}`);
			return 0;
		}
	}

	// Only make canvas once
	const canvas = measureTextWidth.canvas
		|| (measureTextWidth.canvas = document.createElement('canvas'));
	const ctx = canvas.getContext('2d');
	ctx.font = style.font;

	const textW = ctx.measureText(text).width;
	const padW = parseFloatFallback(style.paddingLeft)
		+ parseFloatFallback(style.paddingRight);
	const borderW = parseFloatFallback(style.borderLeftWidth)
		+ parseFloatFallback(style.borderRightWidth);
	
	return Math.ceil(textW + padW + borderW);
}
