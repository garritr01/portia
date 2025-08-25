// App.js

import React, { useState, useMemo, useEffect } from 'react';
import { LeftMenu } from './views/LeftMenu';
import { useSmallScreen, useSwipe } from './helpers/DynamicView';
import { Login, Logout, useUser } from './contexts/UserContext';
import { DayView, MonthView, YearView } from './views/Calendar';
import { useConnCheck, useAuthCheck } from './requests/Tests';
import { useTZ, normedCheck, defineCalendarDates, normDate } from './helpers/DateTimeCalcs';

export const App = () => {

	// --- INITIAL TESTS ----------------------------------------------------------------
	useConnCheck(); // Hit backend to check connectivity
	const { user } = useUser() || false;
	useAuthCheck(user); // Hit backend with auth to check auth

	// --- VIEW HANDLERS ----------------------------------------------------------------
	// Screen dim context
	const smallScreen = useSmallScreen() ?? false;
	// Determines share of screen
	const [leftExpanded, setLeftExpanded] = useState(false);
	// Minimize left menu when small screen on swipe left
	useSwipe({ onSwipeLeft: smallScreen && leftExpanded ? () => setLeftExpanded(false) : null });
	
	// --- DATE AND DEPENDENT HANDLERS ---------------------------------------------------------------
	const { localTZ } = useTZ();
	const [span, setSpan] = useState('day'); // Determines calendar view ('year', 'month', 'day')
	const [selectedDate, setSelectedDate] = useState(normDate(new Date())); // Day user most recently interacted with

	useEffect(() => (
		setSpan(prev => ((smallScreen || leftExpanded) && span !== 'day') ? 'day' : prev)
	), [smallScreen, leftExpanded]);

	// Alter date range when necessary
	const days = useMemo(() => (
		(smallScreen || leftExpanded) ? [selectedDate] : defineCalendarDates(selectedDate, 'day')
	), [selectedDate, span, smallScreen, leftExpanded, localTZ]);

	useEffect(() => console.log('span', span), [span]);
	useEffect(() => console.log('selectedDate:', selectedDate, '\ndays:', days), [days]);

	// Update date range and span when month or day cell is clicked
	const onCellClick = (date, view) => {
		normedCheck(date);
		const updatedDate = new Date(date.getTime());
		if (view === 'year') {
			updatedDate.setMonth(0);
			updatedDate.setDate(1);
		} else if (view === 'month') {
			updatedDate.setDate(1);
		}
		updatedDate.setHours(0, 0, 0, 0);
		setSelectedDate(updatedDate);
		setSpan(view);
	};

	return (
		<>
			{!user ? <Login/>
				:
				<div className="container">
					<LeftMenu
						Logout={Logout}
						leftExpanded={leftExpanded}
					/>
					{!smallScreen && <button className="resizer" onClick={() => setLeftExpanded(!leftExpanded)}>||</button>}
					<div className={`calendar ${!leftExpanded ? 'expand' : ''}`}>
						{smallScreen && <button className="hamburger" onClick={() => setLeftExpanded(true)}>☰</button>}
						{span === 'day' ? 
							<DayView 
								selectedDate={selectedDate}
								days={days}
								onDayClick={onCellClick}
								leftExpanded={leftExpanded}
								/>
							: <p>Not sure how you got here.</p>
						}
					</div>
				</div>
			}
		</>
	);
};
