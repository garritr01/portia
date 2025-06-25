import { useEffect } from 'react';

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
