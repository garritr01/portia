// helpers/Measure.js

import ReactDOMServer from 'react-dom/server';
import { toCamel } from './Misc';

/* Create pseudo-element for any measuring (snapshotStyles in kebab-case) */
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

/* 
	Get snapshotStyles (camelCase) of jsxElements wrapped in a div, include id='name_target' in relevant elements. 
	Returns { 'nameA': { 'snapshotStyleA': valueA, 'snapshotStyleB': valueB } }
*/
export const getDummyWithChildrenStyle = (jsxElements, snapshotStyles) => {
	const container = document.createElement('div');
	Object.assign(container.style, {
		position: 'absolute',
		visibility: 'hidden',
		pointerEvents: 'none',
	});
	document.body.appendChild(container);

	container.innerHTML = ReactDOMServer.renderToStaticMarkup(jsxElements);
	document.body.appendChild(container);

	const targets = container.querySelectorAll('[id$="_target"]');
	const result = {};

	targets.forEach(e => {
		const name = e.id.split('_')[0];
		const styles = {};
		const live = window.getComputedStyle(e);

		snapshotStyles.forEach(prop => {
			let val = live.getPropertyValue(prop);
			if (val.endsWith('px')) {
				val = parseFloat(val);
			}
			styles[toCamel(prop)] = val;
		});
		result[name] = styles;
	})

	document.body.removeChild(container);

	return result;
}

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
