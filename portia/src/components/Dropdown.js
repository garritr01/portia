import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { useKeyNav } from '../contexts/KeyNavContext';
import { useScreen } from '../contexts/ScreenContext';
import { measureTextWidth } from '../helpers/Measure';
import { ErrorInfoButton } from './Notifications';

/** Finite pseudo-rolling drop select */
export const DropSelect = ({ options = [], value, setter, allowType = false, numericOnly = false, realtimeUpdate = false, errorInfo }) => {
	const { smallScreen = false } = useScreen() || {};
	const { currentNav } = useKeyNav() || {};

	// Repeat until 20 options present, using at least 4 copies
	const repeats = options.length === 0 ? 20
		: options.length >= 5 ? 4 
		: Math.ceil(20 / options.length);
	// Defines starting index and number of copies to bounce (4 -> 1), (5, 6 -> 2)
	const middleIdx = Math.ceil(repeats / 2) - 1;
	const paddedOptions = Array(repeats).fill(options).flat();
	// Holds typed value
	const [rVal, setRVal] = useState(value);
	// Width to use
	const [width, setWidth] = useState(0);
	// positional refs
	const headRef = useRef(null);
	const chevRef = useRef(null);
	const listRef = useRef(null);
	const lensRef = useRef(null);
	const snapTimeout = useRef(null);

	// Keep rVal synced with composite
	useEffect(() => setRVal(value), [value]);

	const isOpen =
		currentNav instanceof HTMLElement
		&& headRef.current instanceof HTMLElement
		&& currentNav.contains(headRef.current);
	const lastOpen = useRef(isOpen);

	// Measure each display in options and return the max width to define dropdown width
	useEffect(() => {
		if (!headRef.current) { return }
		const style = window.getComputedStyle(headRef.current);
		const maxWidth = [ ...options, value].reduce((max, opt) => Math.max(max, measureTextWidth(opt.display, style)), 0);
		setWidth(maxWidth);
	}, [options, value]);

	// start on selected value
	useEffect(() => {
		if (!isOpen || !listRef || !listRef.current) { return }
		const uniqueHeight = listRef.current.scrollHeight / repeats;
		const optIdx = options.findIndex(opt => opt.value === value.value);
		const optHeight = listRef.current.scrollHeight / paddedOptions.length;
		// No found idx returns -1
		if (optIdx >= 0) {
			listRef.current.scrollTop = (middleIdx * uniqueHeight) + (optIdx * optHeight);
		}
	}, [isOpen]);

	/** Handle rollover scrolling */
	const handleRolloverScroll = (elm) => {
		const scrollHeight = elm.scrollHeight;
		const scrollTop = elm.scrollTop;
		const scrollBottom = scrollHeight - scrollTop - elm.clientHeight;
		const uniqueHeight = scrollHeight / repeats; // Height of single set of options

		// Define distance from ends to trigger snap
		const triggerDist = Math.max(uniqueHeight, elm.clientHeight);

		// Simulate infinite scroll by skipping to same value in middle when nearing edges
		if (scrollTop < triggerDist) {
			elm.scrollTop += middleIdx * uniqueHeight;
		} else if (scrollBottom < triggerDist) {
			elm.scrollTop -= middleIdx * uniqueHeight;
		}

		// Reset timeout when scrolling to allow delay before snapping to nearest value
		if (smallScreen) {
			clearTimeout(snapTimeout.current);
			snapTimeout.current = setTimeout(() => snapCallback(paddedOptions, setRVal, listRef, lensRef, smallScreen), 500); // 500 ms timer
		}
	}

	return (
		<DropView
			isOpen={isOpen}
			lastOpen={lastOpen}
			value={value}
			setter={setter}
			options={paddedOptions}
			allowType={allowType && !smallScreen}
			realtimeUpdate={realtimeUpdate}
			rVal={rVal}
			setRVal={setRVal}
			headRef={headRef}
			chevRef={chevRef}
			listRef={listRef}
			lensRef={lensRef}
			scrollHandler={handleRolloverScroll}
			width={width}
			numericOnly={numericOnly}
			errorInfo={errorInfo}
		/>
	);
}

/** Infinite numerical drop select */
export const InfDropSelect = ({ min = -9999, max = 9999, buffer = 10, value, setter, allowType = false, realtimeUpdate = false, errorInfo }) => {
	const { smallScreen = false } = useScreen() || {};
	const { currentNav } = useKeyNav() || {};
	// NOTE - .value is just so I can reuse the same DropView

	const [rVal, setRVal] = useState(value);
	const headRef = useRef(null);
	const chevRef = useRef(null);
	const listRef = useRef(null);
	const lensRef = useRef(null);
	const snapTimeout = useRef(null);

	const isOpen =
		currentNav instanceof HTMLElement
		&& headRef.current instanceof HTMLElement
		&& currentNav.contains(headRef.current);
	const lastOpen = useRef(isOpen);

	const [start, setStart] = useState(value.value - buffer);
	const options = useMemo(() => {
		return Array.from({ length: (3 * buffer) }, (_, i) => (
			(start + i) < min ? { display: null, value: null }
				: (start + i) > max ? { display: null, value: null }
					: { display: String(start + i), value: (start + i) }
		));
	}, [start]);

	// Keep rVal synced with composite
	useEffect(() => setRVal(value), [value]);

	// Snap to selected if open
	useEffect(() => {
		if (!isOpen || !listRef || !listRef.current) { return }
		const optIdx = options.findIndex(opt => opt.value === value.value);
		const optHeight = listRef.current.scrollHeight / options.length;;
		if (optIdx >= 0) { listRef.current.scrollTop = (optIdx * optHeight); }
	}, [isOpen]);

	const handleInfScroll = (elm) => {
		const scrollHeight = elm.scrollHeight;
		const scrollTop = elm.scrollTop;
		const optHeight = scrollHeight / options.length;
		const bufferHeight = buffer * optHeight;
		const nonNullRange = {
			start: options.findIndex(v => v.value !== null) * optHeight,
			end: ((options.length - 1) - [...options].reverse().findIndex(v => v.value !== null)) * optHeight,
		}

		// Block scroll into nulls
		if (scrollTop < nonNullRange.start - (optHeight / 3)) {
			elm.scrollTop = nonNullRange.start;
		} else if (scrollTop > nonNullRange.end + (optHeight / 3)) {
			elm.scrollTop = nonNullRange.end;
		}

		// Simulate infinite scroll by snapping to new location of value IF not at end of range
		if (options[0].value !== null && scrollTop < bufferHeight) {
			setStart(prev => prev - buffer);
			elm.scrollTop += bufferHeight;
		} else if (options[options.length - 1].value !== null && scrollTop > (scrollHeight - bufferHeight)) {
			setStart(prev => prev + buffer);
			elm.scrollTop -= bufferHeight;
		}

		// Reset timeout when scrolling to allow delay before snapping to nearest value
		if (smallScreen) {
			clearTimeout(snapTimeout.current);
			snapTimeout.current = setTimeout(() => snapCallback(options, setRVal, listRef, lensRef), 500);
		}
	}

	return (
		<DropView
			isOpen={isOpen}
			lastOpen={lastOpen}
			value={value}
			setter={setter}
			options={options}
			allowType={allowType && !smallScreen}
			realtimeUpdate={realtimeUpdate}
			rVal={rVal}
			setRVal={setRVal}
			headRef={headRef}
			chevRef={chevRef}
			listRef={listRef}
			lensRef={lensRef}
			scrollHandler={handleInfScroll}
			width={'2.25rem'}
			numericOnly={true}
			errorInfo={errorInfo}
		/>
	);
}

/** Snap to nearest value and set it if smallScreen */
const snapCallback = (options, setRVal, listRef, lensRef) => {
	if (!listRef.current || !lensRef.current) { return }

	// Get 'lens' rect and all droptions
	const lensRect = lensRef.current.getBoundingClientRect();
	const droptions = Array.from(listRef.current.querySelectorAll('.droption'));

	// Find the nearest option's offset
	const closestOption = droptions.reduce((nearest, opt, idx) => {
		const diff = opt.getBoundingClientRect().top - lensRect.top;
		return (nearest === null || Math.abs(diff) < Math.abs(nearest.diff)) ? { diff, idx } : nearest;
	}, { diff: Infinity, idx: null });
	if (closestOption.idx === null) { return }

	// Scroll to closest option
	listRef.current.scrollTo({
		top: listRef.current.scrollTop + closestOption.diff,
		behavior: 'smooth'
	});

	setRVal(options[closestOption.idx]);
}

/** Render the scrollable dropdown menu used by the DropSelects */
const DropView = ({ isOpen, lastOpen, options, value, setter, rVal, setRVal, allowType, numericOnly, realtimeUpdate, errorInfo, headRef, chevRef, listRef, lensRef, scrollHandler, width }) => {
	const { smallScreen = false } = useScreen() || {};
	const { goNext } = useKeyNav() || {};

	const handleArrow = useCallback((e) => {
		if (!isOpen || !listRef?.current || e.ctrlKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) { return }

		e.preventDefault();
		const addend = e.key === "ArrowDown" ? 1 : -1;
		const currIdx = options.findIndex(opt => opt.value === rVal.value);
		const nextIdx = (currIdx < 1 && addend < 0) ? options.length - 1 : (currIdx + addend) % options.length
		const optHeight = listRef.current.scrollHeight / options.length;
		listRef.current.scrollTop = (currIdx + addend) * optHeight;
		setRVal(options[nextIdx]);
		setter(options[nextIdx].value);

	}, [isOpen, options, rVal, setRVal]);

	// Mount keydown
	useEffect(() => {
		if (!isOpen) { return }
		document.addEventListener("keydown", handleArrow);
		return () => document.removeEventListener("keydown", handleArrow);
	}, [isOpen, handleArrow]);

	// Handle closing and openings
	useEffect(() => {

		if (isOpen && (!lastOpen || !lastOpen.current)) { handleOpen() }
		else if (lastOpen && lastOpen.current) { handleClose() }

	}, [isOpen]);

	const handleOpen = () => {
		lastOpen.current = isOpen;
	}

	const handleClose = (newVal = null) => {
		if (newVal) {
			//console.log("Setting with newVal: ", newVal);
			setRVal(newVal);
			setter(newVal.value);
		} else {
			//console.log("Setting with rVal.value: ", rVal.value);
			setter(rVal.value); // Closing should only cause an update in the small screen case
		}
		lastOpen.current = isOpen;
	}

	return (
		<div className="drop">

			<div className={errorInfo?.err ? "erred dropHeader" : "dropHeader"}>

				{/** Use an input if allowType */}
				{allowType ?
					<input
						value={rVal.display}
						onChange={(e) => {
							const val = numericOnly ? e.target.value.replace(/\D+/g, '') : e.target.value;
							setRVal({ display: val, value: val })
							if (realtimeUpdate) { setter(val) }
						}}
						onFocus={(e) => e.target.select()} // Highlight on focus
						onBlur={() => setter(rVal.value)}
						ref={headRef}
						style={{ width }}
						inputMode={numericOnly ? "numeric" : undefined}
					/>
					: <p ref={headRef} style={{ width }}>{value.display}</p>
				}

				{/** Dropdown arrow for opening/closing */}
				<FiChevronDown className={`chevron ${isOpen ? "open" : ""}`} ref={chevRef}/>

				<ErrorInfoButton {...errorInfo} />

			</div>

			{isOpen && (
				<>
					{ // Only use the lens in the smallScreen case (no snapping)
						smallScreen && <div className="dropLens" ref={lensRef} style={{ top: allowType && '100%' }} />
					}
					<div
						className="droptions"
						ref={listRef}
						onScroll={(e) => scrollHandler(e.target)}
						style={{ top: allowType && '100%' }}
						>
						{options.map((option, idx) => (
							<div
								key={idx}
								className={`droption ${option.value === rVal.value ? "selected" : ""}`}
								onClick={(e) => handleClose(option)}>
								{option.display}
							</div>
						))}
					</div>
				</>
			)}

		</div>
	);
}
