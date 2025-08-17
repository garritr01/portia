// helpers/DynamicView.js

import { useState, useEffect } from 'react';

/**
 * 
 * @param {number} thresh - Threshold to decide 'smallScreen' bool
 * @param {number} threshPad - Pad to prevent 'thrashing'
 * @returns { smallScreen: boolean }
 */
export const useSmallScreen = (thresh = 600, threshPad = 25) => {
	const init = window.innerWidth <= thresh;
	const [smallScreen, setSmallScreen] = useState(init);

	const onResize = () => {
		const w = window.innerWidth;
		setSmallScreen(prev =>
			(!prev && w <= (thresh - threshPad)) ? true :
			(prev && w >= (thresh + threshPad)) ? false :
			prev
		);
	};

	useEffect(() => {
		window.addEventListener('resize', onResize);
		window.addEventListener('orientationchange', onResize);

		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('orientationchange', onResize);
		}
	}, [thresh, threshPad]);

	return smallScreen;
}

/**
 * Get screen dimensions
 * @param {number} delay - Wait for screen to be stable for x ms before passing new dims
 * @returns { screenDims: Object<{ w: number, h: number }> }
 */
export const useWindowSize = (delay = 200) => {
	const [screenDims, setScreenDims] = useState({ w: window.innerWidth, h: window.innerHeight });

	useEffect(() => {
		let timeout;

		const onResize = () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				setScreenDims({ w: window.innerWidth, h: window.innerHeight });
			}, delay);
		};

		window.addEventListener('resize', onResize);
		window.addEventListener('orientationchange', onResize);

		return () => {
			clearTimeout(timeout);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('orientationchange', onResize);
		};
	}, [delay]);

	return screenDims;
};


/** Swipe listeners, pass in functions to run onSwipe{direction} */
export const useSwipe = ({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }) => {

	useEffect(() => {

		const target = window;
		if (!target) return;

		const minSwipe = 50;
		let startX = 0;
		let startY = 0;
		let endX = 0;
		let endY = 0;

		const handleTouchStart = (e) => {
			startX = e.changedTouches[0].screenX;
			startY = e.changedTouches[0].screenY;
		}

		const handleTouchEnd = (e) => {
			endX = e.changedTouches[0].screenX;
			endY = e.changedTouches[0].screenY;
			handleSwipe();
		}

		const handleSwipe = () => {
			const dX = endX - startX;
			const dY = endY - startY;

			// Pick (arbitrarily on diag) swipe direction
			if (Math.abs(dX) > Math.abs(dY)) {
				if (dX > minSwipe && onSwipeRight) {
					onSwipeRight();}
				else if (dX < -minSwipe && onSwipeLeft) {
					onSwipeLeft();}
			} else {
				if (dY > minSwipe && onSwipeDown) {
					onSwipeDown();}
				else if (dY < -minSwipe && onSwipeUp) {
					onSwipeUp();
				
				}
			}
		}

		target.addEventListener('touchstart', handleTouchStart);
		target.addEventListener('touchend', handleTouchEnd);

		return () => {
			target.removeEventListener('touchstart', handleTouchStart);
			target.removeEventListener('touchend', handleTouchEnd);
		}
	}, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

}
