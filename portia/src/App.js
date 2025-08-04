// App.js

import React, { useState, useEffect } from 'react';
import { LeftMenu } from './views/LeftMenu';
import { useSwipe } from './helpers/DynamicView';
import { Login, Logout, useUser } from './contexts/UserContext';
import { useScreen } from './contexts/ScreenContext';
import { DayView, MonthView, YearView } from './views/Calendar';
import { useConnCheck, useAuthCheck } from './requests/Tests';
import { returnDates, normDate } from './helpers/DateTimeCalcs';

export const App = () => {
	// --- INITIAL TESTS ----------------------------------------------------------------
	useConnCheck(); // Hit backend to check connectivity
	const { user } = useUser() || false;
	useAuthCheck(user); // Hit backend with auth to check auth

	// --- VIEW HANDLERS ----------------------------------------------------------------
	// Screen dim context
	const { smallScreen = false } = useScreen() || {};
	// Determines share of screen
	const [leftExpanded, setLeftExpanded] = useState(false);
	// Minimize left menu when small screen
	useSwipe({ onSwipeLeft: smallScreen && leftExpanded ? () => setLeftExpanded(false) : null });
	
	// --- DATE AND DEPENDENT HANDLERS ----------------------------------------------------------------
	// Determines calendar view ('year', 'month', 'day'-ish)
	const [span, setSpan] = useState('day');
	// Day user most recently interacted with
	const [selectedDate, setSelectedDate] = useState(normDate(new Date()));
	// Array containing each date in view
	const [days, setDays] = useState([]);
	// Alter date range when necessary
	useEffect(() => {
		//console.log('left exp:', leftExpanded, 'smallScreen:', smallScreen);
		setDays((smallScreen || leftExpanded) ? [selectedDate] : returnDates(selectedDate, 'day'));
		if ((smallScreen || leftExpanded) && span !== 'day') { setSpan('day') }
	}, [selectedDate, span, smallScreen, leftExpanded]);

	// Update date range and span when month or day cell is clicked
	const onCellClick = (date, view) => {
		const updatedDate = new Date(date);
		if (view === 'year') {
			updatedDate.setMonth(0);
			updatedDate.setDate(1);
		} else if (view === 'month') {
			updatedDate.setDate(1);
		}
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
