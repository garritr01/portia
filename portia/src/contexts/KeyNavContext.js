import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from "react";
import { useScreen } from './ScreenContext';

const keyNavContext = createContext({ current: null, setCurrent: () => {}, navOrder: [] });

export const KeyNavProvider = ({ children }) => {
	const { smallScreen = false } = useScreen() || {};
	const [current, setCurrent] = useState(null);
	const orderRef = useRef([]);

	useEffect(() => console.log("Current Nav: ", current), [current]);

	// Update current then focus & blur if applicable
	const focusBehavior = useCallback((newElm) => {

		const cell = newElm?.closest?.(".navCell");

		// Focus any new input or textarea, or maintain focus on last
		if (!(cell instanceof HTMLElement)) { return }

		const focusableChild = cell.querySelector("input, textarea, button, .relButton");
		const prevFocusableChild = current?.querySelector("input, textarea, button, .relButton");

		// If cell is not current
		if (cell !== current) {
			// If new has focusable, focus, otherwise blur old
			if (focusableChild && typeof focusableChild.focus === 'function') {
				console.log("Focusing on: ", focusableChild);
				focusableChild.focus();
			} else if (prevFocusableChild && typeof focusableChild.focus === 'function') {
				console.log("Blurring: ", prevFocusableChild);
			}
		}
		setCurrent(cell);

	}, [setCurrent, current]);

	// Set current to first element in navOrder when 
	const currentFallback = useCallback(() => {
		if (!current || !document.body.contains(current)) {
			const flat = orderRef.current.flat();
			if (flat[0] instanceof HTMLElement && document.body.contains(flat[0])) {
				focusBehavior(flat[0]);
			}
		}
	}, [current, focusBehavior]);

	const rebuildNavOrder = useCallback(() => {
		const rows = document.body.querySelectorAll(".navBlock .navRow");
		const navOrder2d = [ ...rows ].map(row => [ ...row.querySelectorAll(".navCell") ]).filter(row => row.length > 0);
		//console.log("NavOrder2D:", navOrder2d);
		orderRef.current = navOrder2d;
		if (!document.body.contains(current)) {
			currentFallback();
		}
	}, [currentFallback]);

	// If certain classes added or removed, rebuild the nav order
	const handleMutation = useCallback((mutations) => {

		const navUpdates = mutations.some((m) => (
			[ ...m.addedNodes, ...m.removedNodes ].some((n) => (
				n instanceof Element && (
					n.matches('.navBlock') ||
					n.matches('.navRow') ||
					n.matches('.navCell')
				)
			))
		));

		if (navUpdates) {
			rebuildNavOrder();
			currentFallback();
		}

	}, [rebuildNavOrder, currentFallback]);

	// Go to next element in orderRef (starts at start)
	const goNext = useCallback((e) => {
		let next;
		const navOrder = orderRef.current;
		if (!navOrder || navOrder.length === 0) { return null }
		
		e.preventDefault();

		if (!current) {
			// Go to beginning
			next = navOrder[0][0];
			//console.log(`goNext: (None) -> (0,0)`);
		} else { 
			const rIdx = navOrder.findIndex(row => row.includes(current));
			const cIdx = navOrder[rIdx].indexOf(current);
			if (rIdx < 0 || cIdx < 0 || (cIdx >= navOrder[rIdx].length - 1 && rIdx >= navOrder.length - 1)) { 
				// Go to beginning
				next = navOrder[0][0];
				//console.log(`goNext: (${rIdx}, ${cIdx}) -> (0,0)`);
			} else if (rIdx < navOrder.length - 1 && cIdx >= navOrder[rIdx].length - 1) { 
				// Go to beginning of next row
				next = navOrder[rIdx + 1][0];
				//console.log(`goNext: (${rIdx}, ${cIdx}) -> (${rIdx + 1},0)`);
			} else { 
				// Go to next cell idx
				next = navOrder[rIdx][cIdx + 1];
				//console.log(`goNext: (${rIdx}, ${cIdx}) -> (${rIdx},${cIdx + 1})`);
			}
		}

		focusBehavior(next);
	}, [current, focusBehavior]);

	// Go to last element in orderRef (starts at end)
	const goLast = useCallback((e) => {
		let next;
		const navOrder = orderRef.current;
		if (!navOrder || navOrder.length === 0) { return null }

		e.preventDefault();

		if (!current) {
			// Go to end of last row
			const lastRow = navOrder[navOrder.length - 1];
			next = lastRow[lastRow.length - 1];
			//console.log(`goLast: (None) -> (${navOrder.length - 1},${lastRow.length - 1})`);
		} else {
			const rIdx = navOrder.findIndex(row => row.includes(current));
			const cIdx = navOrder[rIdx].indexOf(current);
			if (rIdx < 0 || cIdx < 0 || (cIdx < 1 && rIdx < 1)) {
				// Go to end of last row
				const lastRow = navOrder[navOrder.length - 1]; 
				next = lastRow[lastRow.length - 1];
				//console.log(`goLast: (${rIdx}, ${cIdx}) -> (${navOrder.length - 1},${lastRow.length - 1})`);
			} else if (cIdx < 1) { 
				// Go to end of prev row
				const prevRow = navOrder[rIdx - 1];
				next = prevRow[prevRow.length - 1];
				//console.log(`goLast: (${rIdx}, ${cIdx}) -> (${rIdx - 1},${prevRow.length - 1})`);
			} else { 
				// Go to prev cell
				next = navOrder[rIdx][cIdx - 1];
				//console.log(`goLast: (${rIdx}, ${cIdx}) -> (${rIdx},${cIdx - 1})`);
			}
		}

		focusBehavior(next);
	}, [current, focusBehavior]);

	// Go straight up (columnar, not spatial)
	const goUp = useCallback((e) => {
		let next;
		const navOrder = orderRef.current;
		if (!navOrder || navOrder.length === 0) { return null }

		e.preventDefault();

		if (!current) {
			// Go to bottom first cell
			//console.log(`goUp: (None) -> (${navOrder.length - 1},0)`);
			next = navOrder[navOrder.length - 1][0];
		} else {
			const rIdx = navOrder.findIndex(row => row.includes(current));
			const cIdx = navOrder[rIdx].indexOf(current);
			if (rIdx < 0 || cIdx < 0) {
				// Go to bottom first cell
				//console.log(`goUp: (${rIdx}, ${cIdx}) -> (${navOrder.length - 1},0)`);
				next = navOrder[navOrder.length - 1][0];
			} else if (rIdx < 1) {
				// Skip to bottom, same cell idx or end of row
				const lastRow = navOrder[navOrder.length - 1];
				//console.log(`goUp: (${rIdx}, ${cIdx}) -> (${navOrder.length - 1},${Math.min(cIdx, lastRow.length - 1)})`);
				next = lastRow[Math.min(cIdx, lastRow.length - 1)];
			} else {
				// Go up a row, same cell or end of row
				const prevRow = navOrder[rIdx - 1];
				//console.log(`goUp: (${rIdx}, ${cIdx}) -> (${rIdx - 1},${Math.min(cIdx, prevRow.length - 1)})`);
				next = prevRow[Math.min(cIdx, prevRow.length - 1)];
			}
		}

		focusBehavior(next);
	}, [current, focusBehavior]);

	// Go straight down (columnar, not spatial)
	const goDown = useCallback((e) => {
		let next;
		const navOrder = orderRef.current;
		if (!navOrder || navOrder.length === 0) { return null }

		e.preventDefault();

		if (!current) {
			// Go to top first cell
			//console.log(`goDown: (None) -> (0,0)`);
			next = navOrder[0][0];
		} else {
			const rIdx = navOrder.findIndex(row => row.includes(current));
			const cIdx = navOrder[rIdx].indexOf(current);
			if (rIdx < 0 || cIdx < 0) {
				// Go to top first cell
				//console.log(`goDown: (${rIdx}, ${cIdx}) -> (0,0)`);
				next = navOrder[0][0];
			} else if (rIdx >= navOrder.length - 1) {
				// Skip to top, same cell idx or end of row				
				const nextRow = navOrder[0];
				//console.log(`goDown: (${rIdx}, ${cIdx}) -> (0,${Math.min(cIdx, nextRow.length - 1)})`);
				next = nextRow[Math.min(cIdx, nextRow.length - 1)];
			} else {
				// Go down a row, same cell or end of row
				const nextRow = navOrder[rIdx + 1];
				//console.log(`goDown: (${rIdx}, ${cIdx}) -> (${rIdx + 1},${Math.min(cIdx, nextRow.length - 1) })`); 
				next = navOrder[rIdx + 1][Math.min(cIdx, nextRow.length - 1)];
			}
		}

		focusBehavior(next);
	}, [current, focusBehavior]);

	// Update current state of nav on click
	const handleClick = useCallback((e) => {	
		//console.log("Click", e.target);
		focusBehavior(e.target);
	}, [focusBehavior]);

	// conditional blur prevention
	const preventBlur = useCallback((e) => {
		if (current instanceof HTMLElement && current.querySelector('input')) {
			e.preventDefault();
		}
	}, [current]);

	const handleTouchStart = useCallback((e) => {
		// Set current to .navCell if it or descendants were clicked
		//console.log("Touch start", e.target);
		const cell = e.target.closest?.(".navCell");
		if (cell instanceof HTMLElement) { focusBehavior(cell, false) }
		else { focusBehavior(null) }

		document.addEventListener("touchend", () => focusBehavior(null), { once: true });
	}, [focusBehavior]);

	// Delegate to nav handlers based on key pressed
	const handleKeyDown = useCallback((e) => {
		// Ignore key nav in textarea
		if (current instanceof HTMLTextAreaElement) { return }

		// Go to next element on tab press
		if (e.key === "Tab") { 
			if (e.shiftKey) { goLast(e) }
			else { goNext(e) }
		} else if (e.ctrlKey) {
			if (e.key === "ArrowUp") { goUp(e) }
			else if (e.key === "ArrowDown") { goDown(e) }
		} else { return }
	}, [current, goNext, goLast, goUp, goDown]);

	// Build navOrder on load
	useEffect(() => rebuildNavOrder(), [rebuildNavOrder]);

	// Mount body observer
	useEffect(() => {
		const obs = new MutationObserver(handleMutation);
		obs.observe(document.body, { childList: true, subtree: true });
		return () => { obs.disconnect() }
	}, [handleMutation]);

	// Mount click and keydown listeners
	useEffect(() => {
		if (smallScreen) {
			document.addEventListener("touchstart", handleTouchStart);
		} else {
			document.addEventListener("click", handleClick);
			document.addEventListener("mousedown", preventBlur);
		}
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			if (smallScreen) {
				document.removeEventListener("touchstart", handleTouchStart);
			} else {
				document.removeEventListener("click", handleClick);
				document.removeEventListener("mousedown", preventBlur);
			}
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [smallScreen, preventBlur, handleTouchStart, handleClick, handleKeyDown]);

	return (
		<keyNavContext.Provider value={{ currentNav: current, goNext, goLast, focusBehavior }}>
			{children}
		</keyNavContext.Provider>
	);
};

export const useKeyNav = () => useContext(keyNavContext);
