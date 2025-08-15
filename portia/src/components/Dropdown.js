// components/Dropdown.js

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { useKeyNav } from '../helpers/KeyNav';
import { useSmallScreen } from '../helpers/DynamicView';
import { measureTextWidth } from '../helpers/Measure';
import { clamp } from '../helpers/Misc';
import { ErrorInfoButton } from './Notifications';

const useDropCore = ({
	isInf,
	value,
	options,
	placeholder,
	realtimeUpdate,
	middleIdx = null,
	repeats = null,
	paddedOptions = null
}) => {

	const smallScreen = useSmallScreen() || false;
	const { currentNav } = useKeyNav() || {};

	// Initialize refs as null
	const headRef = useRef(null);
	const chevRef = useRef(null);
	const listRef = useRef(null);
	const lensRef = useRef(null);
	const snapTimeout = useRef(null);

	// Indicates what was and is open (trigger update when was open and is no longer open)
	const isOpen = currentNav instanceof HTMLElement && headRef.current instanceof HTMLElement && currentNav.contains(headRef.current);
	const lastOpen = useRef(isOpen);

	// Keep rVal synced with value
	const [rVal, setRVal] = useState(value);
	useEffect(() => setRVal(value), [value]);

	// Measure each display in options and return the max width to define dropdown width
	const [width, setWidth] = useState(0);
	useEffect(() => {
		if (!headRef.current) { return }
		const style = window.getComputedStyle(headRef.current);
		const placeholderObj = { display: placeholder };
		const maxWidth = [...options, value, placeholderObj].reduce((max, opt) => Math.max(max, measureTextWidth(opt?.display || '', style)), 0);
		setWidth(maxWidth);
	}, [options, value]);

	// start on selected value
	useEffect(() => {
		if (!isOpen || !listRef || !listRef.current || !options?.length || (!isInf && !paddedOptions?.length)) { return }
		const optIdx = options.findIndex(opt => opt?.value === value?.value);
		// No found idx returns -1
		if (optIdx >= 0) {
			if (isInf) {
				const optHeight = listRef.current.scrollHeight / options.length;
				listRef.current.scrollTop = (optIdx * optHeight);
			} else {
				const optHeight = listRef.current.scrollHeight / paddedOptions.length;
				const uniqueHeight = listRef.current.scrollHeight / repeats;
				listRef.current.scrollTop = (middleIdx * uniqueHeight) + (optIdx * optHeight);
			}
		}
	}, [isOpen]);

	// snap to first display that meets starts with the current display (realtime update and finite case)
	useEffect(() => {
		if (smallScreen || !realtimeUpdate || isInf || !isOpen || !listRef || !listRef.current || !options?.length || !paddedOptions?.length) { return }
		const optIdx = options.findIndex(opt => opt?.display?.startsWith(value?.display));
		// No found idx returns -1
		if (optIdx >= 0) {
			const uniqueHeight = listRef.current.scrollHeight / repeats;
			const optHeight = listRef.current.scrollHeight / paddedOptions.length;
			listRef.current.scrollTop = (middleIdx * uniqueHeight) + (optIdx * optHeight);
		}
	}, [value]);

	return {
		smallScreen,
		rVal, setRVal,
		width,
		headRef, chevRef, listRef, lensRef,
		snapTimeout,
		isOpen, lastOpen
	};
};

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
};

/** Finite pseudo-rolling drop select */
export const DropSelect = ({ 
	options = [],
	value,
	setter,
	errorInfo,
	dropHeaderID,
	placeholder = '',
	allowType = false,
	numericOnly = false,
	realtimeUpdate = false,
	commitEmpty = true
}) => {

	// Repeat until 20 options present, using at least 4 copies
	const repeats = options.length === 0 ? 20
		: options.length >= 5 ? 4
			: Math.ceil(20 / options.length);
	// Defines starting index and number of copies to bounce (4 -> 1), (5, 6 -> 2)
	const middleIdx = Math.ceil(repeats / 2) - 1;
	const paddedOptions = Array(repeats).fill(options).flat();

	const {
		smallScreen,
		rVal, setRVal,
		width,
		headRef, chevRef, listRef, lensRef,
		snapTimeout,
		isOpen, lastOpen
	} = useDropCore({
		isInf: false,
		value, 
		options, 
		placeholder, 
		realtimeUpdate, 
		middleIdx, 
		repeats, 
		paddedOptions
	});

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
			isInf={false}
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
			commitEmpty={commitEmpty}
			errorInfo={errorInfo}
			dropHeaderID={dropHeaderID}
			placeholder={placeholder}
		/>
	);
};

/** Infinite numerical drop select */
export const InfDropSelect = ({ 
	min = Number.NEGATIVE_INFINITY,
	max = Number.POSITIVE_INFINITY,
	buffer = 10,
	value,
	setter,
	errorInfo,
	dropHeaderID,
	placeholder = '',
	allowType = false,
	numericOnly = true, // Must always be true here
	realtimeUpdate = false,
	commitEmpty = true,
}) => {

	const [start, setStart] = useState(value?.value - buffer);
	const lastOptionsRef = useRef([]);
	const nBuffers = 3;
	const options = useMemo(() => {

		const arr = Array.from({ length: (nBuffers * buffer) }, (_, i) => {
			const v = start + i;
			return (
				(v < min || v > max) ? 
					{ display: null, value: null }
					: { display: String(v), value: v }
			)
		});

		lastOptionsRef.current = arr;
		return arr;
	}, [start, min, max, buffer]);

	const {
		smallScreen,
		rVal, setRVal,
		width,
		headRef, chevRef, listRef, lensRef,
		snapTimeout,
		isOpen, lastOpen
	} = useDropCore({
		isInf: true,
		value,
		options,
		placeholder,
		realtimeUpdate
	});

	const handleInfScroll = (elm) => {
		const scrollHeight = elm.scrollHeight;
		const scrollTop = elm.scrollTop;
		const optLen = options.length || 1;
		const optHeight = scrollHeight / optLen;
		const bufferHeight = buffer * optHeight;
		const nonNullRange = {
			start: options.findIndex(v => v.value !== null) * optHeight,
			end: ((optLen - 1) - [...options].reverse().findIndex(v => v.value !== null)) * optHeight,
		}

		// Block scroll into nulls
		if (scrollTop < nonNullRange.start - (optHeight / nBuffers)) {
			elm.scrollTop = nonNullRange.start;
		} else if (scrollTop > nonNullRange.end + (optHeight / nBuffers)) {
			elm.scrollTop = nonNullRange.end;
		}

		const currentVal = Number(value?.value);
		if (Number.isNaN(currentVal)) { return }

		// Simulate infinite scroll by snapping to new location of value IF not at end of range
		if (options[0].value !== null && scrollTop < bufferHeight) {
			setStart(prev => clamp(prev - buffer, min, max));
			elm.scrollTop += bufferHeight;
		} else if (options[optLen - 1].value !== null && scrollTop > (scrollHeight - bufferHeight)) {
			setStart(prev => clamp(prev + buffer, min, max));
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
			isInf={true}
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
			width={width}
			numericOnly={numericOnly}
			commitEmpty={commitEmpty}
			errorInfo={errorInfo}
			dropHeaderID={dropHeaderID}
			placeholder={placeholder}
			min={min}
			max={max}
		/>
	);
};

/** Render the scrollable dropdown menu used by the DropSelects */
const DropView = ({
	isInf,
	isOpen,
	lastOpen,
	options,
	value,
	setter,
	rVal,
	setRVal,
	allowType, // Flag (if true) allows the user to type in an input
	numericOnly, // Flag (if true) prevents non-numeric digits (also numeric keyboard on mobile I think)
	realtimeUpdate, // Flag (if true) commits value on type
	commitEmpty, // Flag (if true with realtimeUpdate) attempts to commit '' while typing (commits regardless on close or key or click if false)
	errorInfo,
	headRef,
	chevRef,
	listRef,
	lensRef,
	scrollHandler,
	width,
	dropHeaderID,
	placeholder,
	min = Number.NEGATIVE_INFINITY,
	max = Number.POSITIVE_INFINITY
}) => {
	const smallScreen = useSmallScreen() || false;

	const handleArrow = useCallback((e) => {
		if (!isOpen || !listRef?.current || e.ctrlKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) { return }

		e.preventDefault();
		const addend = e.key === "ArrowDown" ? 1 : -1;
		const optLength = options.length || 1;
		const optHeight = listRef.current.scrollHeight / optLength;

		// Get 'lens' rect and all droptions
		const listRect = listRef.current.getBoundingClientRect();
		const droptions = Array.from(listRef.current.querySelectorAll('.droption'));

		// Find the nearest option's offset
		const closestDroption = droptions.reduce((nearest, opt, idx) => {
			const diff = opt.getBoundingClientRect().top - listRect.top;
			return (nearest === null || Math.abs(diff) < Math.abs(nearest.diff)) ? { diff, idx } : nearest;
		}, { diff: Infinity, idx: null });
		if (closestDroption.idx === null) { return }

		const closestOption = options[closestDroption.idx];
		const currIdx = closestDroption.idx;
		let nextIdx;
		if (closestOption?.value === rVal?.value) {
			nextIdx = (currIdx < 1 && addend < 0) ? optLength - 1 : (currIdx + addend) % optLength;
		} else {
			nextIdx = currIdx;
		}

		listRef.current.scrollTop = nextIdx * optHeight;
		setRVal(options[nextIdx]);
		setter(options[nextIdx].value);

	}, [isOpen, options, rVal]);

	// Mount and unmount keydown listeners
	useEffect(() => {
		if (!isOpen) { return }
		document.addEventListener("keydown", handleArrow);
		return () => document.removeEventListener("keydown", handleArrow);
	}, [isOpen, handleArrow]);

	// Trigger opening and closing operations
	useEffect(() => {

		if (isOpen && (!lastOpen || !lastOpen.current)) { handleOpen() }
		else if (lastOpen && lastOpen.current) { handleClose() }

	}, [isOpen]);

	// nav 'Focus' handler
	const handleOpen = () => {
		lastOpen.current = isOpen;
	}

	// nav 'Blur' handler
	const handleClose = (newVal = null) => {
		if (newVal) {
			//console.log("Setting with newVal: ", newVal);
			if ('value' in newVal) {
				setRVal(newVal);
				setter(newVal.value);
			} else {
				console.warn("Cannot find newVal.value to use in setter.")
			}
		} else {
			//console.log("Setting with rVal.value: ", rVal.value);
			if (rVal && 'value' in rVal) {
				setter(rVal.value); // Closing should only cause an update in the small screen case
			} else {
				console.warn("Cannot find rVal.value to use in setter.");
			}
		}
		lastOpen.current = isOpen;
	}

	// Handle numeric clamping and comitting to setter on type
	const handleType = (raw) => {

		if (numericOnly) {
			const stripped = raw.replace(/\D+/g, '');

			if (stripped === '') {
				setRVal({ display: String(''), value: '' })
				if (realtimeUpdate && commitEmpty) { setter('') }
				return;
			}

			const val = clamp(Number(stripped), min, max);
			setRVal({ display: stripped, value: val });
			if (realtimeUpdate) { setter(val) }

		} else {

			setRVal({ display: raw, value: raw });
			if (realtimeUpdate) { setter(raw) }

		}

	}

	return (
		<div className="drop">

			<div key={dropHeaderID} id={dropHeaderID} className={errorInfo?.err ? "erred dropHeader" : "dropHeader"}>

				{/** Use an input if allowType */}
				{allowType ?
					<input
						placeholder={placeholder}
						value={rVal?.display}
						onChange={(e) => handleType(e.target.value)}
						onFocus={(e) => e.target.select()} // Highlight on focus
						onBlur={() => setter(rVal.value)}
						ref={headRef}
						style={{ width }}
						inputMode={numericOnly ? "numeric" : undefined}
					/>
					: <p ref={headRef} style={{ width }}>{value?.display}</p>
				}

				{/** Dropdown arrow for indicating open and close capacity (kind of misleading atm) */}
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
						{options.map((option, idx) => {
							let safeOption = option;
							if (!('display'in option) || !('value' in option)) {
								console.warn("Cannot use option: ", option)
								safeOption = { display: 'Cannot display', value: 'invalid' }
							}
							return (
								<div
									key={idx}
									className={`droption ${safeOption.value === rVal?.value ? "selected" : ""}`}
									onClick={() => handleClose(safeOption)}>
									{safeOption.display}
								</div>
							);
						})}
					</div>
				</>
			)}

		</div>
	);
};
