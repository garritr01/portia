import { useEffect, useState, useRef } from 'react';

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
		};
		const handleTouchEnd = (e) => {
			endX = e.changedTouches[0].screenX;
			endY = e.changedTouches[0].screenY;
			handleSwipe();
		};
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
		};

		target.addEventListener('touchstart', handleTouchStart);
		target.addEventListener('touchend', handleTouchEnd);

		return () => {
			target.removeEventListener('touchstart', handleTouchStart);
			target.removeEventListener('touchend', handleTouchEnd);
		};
	}, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

};

export const DropSelect = ({ options = [], value, onChange }) => {
	// close on click
	const [open, setOpen] = useState(false);
	// positional refs
	const listRef = useRef(null);

	// 'snap' to center
	useEffect(() => {
		if (open && listRef.current) {
			const optionHeight = listRef.current.scrollHeight / (options.length * 3);
			const index = options.findIndex(opt => opt.value === value.value);
			if (index !== -1) {
				const scrollTo = (index + options.length) * optionHeight - optionHeight / 3;
				listRef.current.scrollTop = scrollTo;
			}
		}
	}, [open, options, value]);

	return (
		<div className="drop">
			<div
				className="dropHeader"
				onClick={() => setOpen(prev => !prev)}
				>
				{value?.display}
				<span className={`chevron ${open ? "open" : ""}`}>⌵</span>
			</div>

			{open && (
				<div className="dropContainer">
					<div className="dropLens" />
					<div
						className="droptions"
						ref={listRef}
						onScroll={(e) => {
							const { scrollTop, scrollHeight } = e.target;
							const third = scrollHeight / 3;
							if (scrollTop < third * 0.5) {
							  e.target.scrollTop += third;
							}
							else if (scrollTop > third * 2.5) {
							  e.target.scrollTop -= third;
							}}}>
							{[...options, ...options, ...options].map((option, idx) => (
								<div
									key={idx}
									className={`droption ${option.value === value.value ? "selected" : ""}`}
									onClick={() => { onChange(option.value); setOpen(false); }}>
									{option.display}
								</div>
							))}
					</div>
				</div>
			)}
		</div>
	);

};

/* Pass element id in on invalid input */
export const invalidInputFlash = (inputId) => {
	const input = document.getElementById(inputId);
	if (input) {
		input.classList.add('invalidFlash');
		setTimeout(() => {
			input.classList.remove('invalidFlash');
		}, 500);
	}
};
