import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertTriangle } from 'react-icons/fi';
import { getDummyStyle, measureTextWidth } from '../helpers/Measure';

/* Pass element id in on invalid input to flash element red */
export const invalidInputFlash = (elementId) => {
	const element = document.getElementById(elementId);
	if (element) {
		element.classList.add('invalidFlash');
		element.addEventListener('animationend', () => element.classList.remove('invalidFlash'), { once: true });
	} else {
		console.warning("No element with id: ", elementId);
	}
}

export const ErrorInfoButton = ({ errID, err }) => {
	const [visible, setVisible] = useState(false);
	const [errLoc, setErrLoc] = useState({ bottom: 0, width: 0, left: 0 });

	useEffect(() => {
		if (!visible) { return }
		const anchor = document.getElementById(errID);
		if (!anchor) { 
			console.warn(`No anchor found with id: ${errID}`);
			return;
		}
		const loc = { position: 'absolute' };
		const rect = anchor.getBoundingClientRect();
		const style = getDummyStyle(err, 'portalError', ['padding-left', 'padding-right', 'border-left-width', 'border-right-width']);
		const errMargin = 8;
		const textWidth = measureTextWidth(err, style);
		const errWidth = Math.min(textWidth, (window.innerWidth - 2 * errMargin)); // Text width minimmum, window width max
		const srcCenter = rect.left + rect.width / 2; // Center of box providing error
		if (srcCenter < (window.innerWidth / 2)) {
			loc['left'] = Math.max((errMargin), (rect.left + rect.width / 2 - errWidth / 2)) + 'px';
		} else {
			loc['left'] = Math.min((window.innerWidth - errWidth - errMargin), (rect.left + rect.width / 2 - errWidth / 2)) + 'px';
		}
		setErrLoc({
			...loc,
			bottom: (window.innerHeight - rect.top + errMargin) + 'px',
			width: errWidth,
		});
	}, [visible, err]);

	if (!err) { return null }
	return (
		<div className="navCell">
			<FiAlertTriangle className="errIndicator" onClick={() => setVisible(prev => !prev)} />
			{visible && 
				<Notification style={errLoc}>{err}</Notification>
			}
		</div>
	)
}

export const Notification = ({ children, style }) => {
	return createPortal(
		<div className="portalError" style={style}>{children}</div>,
		document.body
	);
};