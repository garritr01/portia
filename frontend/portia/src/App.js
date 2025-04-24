/* App.js */
import React, { useState, useEffect } from 'react';
import { useSwipe } from './dynamicView';
import { useScreen, Login, useUser } from './Contexts';
import { AppLayout } from './AppLayout';
import { DayView, MonthView, YearView } from './Calendar';
import { useFetchWithAuth } from './Requests';
import { returnDates, addTime } from './dateTimes'

export const App = () => {

	// --- VIEW HANDLERS ----------------------------------------------------------------
	// Screen dim context
	const { smallScreen = false } = useScreen() || {};
	// Determines share of screen
	const [leftExpanded, setLeftExpanded] = useState(false);
	// Minimize left menu when small screen
	useSwipe({ onSwipeLeft: smallScreen && leftExpanded ? () => setLeftExpanded(false) : null });
	
	// --- DATE HANDLERS ----------------------------------------------------------------
	// User context
	const { user } = useUser() || false;
	// Determines calendar view ('year', 'month', 'day'-ish)
	const [span, setSpan] = useState('day');
	// Day user most recently interacted with
	const [selectedDate, setSelectedDate] = useState(new Date());
	// Array containing each date in view
	const [days, setDays] = useState([]);

	// --- DATA HANDLERS ----------------------------------------------------------------
	// Give initial state to forms
	const [form, setForm] = useState({ path: '', content: [], startTime: null, endTime: null });
	// Recorded events
	const modEvents = useEventsList(); // 'Moderate' useEffect (allow events to be updated)
	const [events, setEvents] = useState([]);

	useEffect(() => { console.log(user)}, [])

	useEffect(() => {
		setEvents(modEvents);
	}, [days]);

	useEffect(() => {
		setDays((smallScreen || leftExpanded) ? [selectedDate] : returnDates(selectedDate, 'day'));
		if ((smallScreen || leftExpanded) && span != 'day') { setSpan('day') }
	}, [selectedDate, span, smallScreen, leftExpanded]);

	useEffect(() => console.log(events.length), [events]);

	const onCellClick = (date, view) => {
		const updatedDate = new Date(date);
		if (view === 'year') {
			updatedDate.setMonth(0);
			updatedDate.setDate(1);
		} else if (view === 'month') {
			updatedDate.setDate(1);
		}
		console.log(`${view}View using `, date);
		setSelectedDate(updatedDate);
		setSpan(view);
	};

	return (
		<>
			{!user ? <Login/>
				:
				<AppLayout 
					menuItems={[]}
					children={
						span === 'year' ? <YearView 
							selectedDate={selectedDate} 
							onMonthClick={onCellClick}
							form={form}
							setForm={setForm} />
						: span === 'month' ? <MonthView 
							selectedDate={selectedDate} 
							onDayClick={onCellClick}
							form={form}
							setForm={setForm} />
						: span === 'day' ? <DayView 
							selectedDate={selectedDate}
							days={days}
							events={events}
							setEvents={setEvents}
							onDayClick={onCellClick}
							form={form}
							setForm={setForm} 
							leftExpanded={leftExpanded} />
						: <p>Not sure how you got here.</p>
					}
					leftExpanded={leftExpanded}
					setLeftExpanded={setLeftExpanded}
					/>
			}
		</>
	);
};

const useEventsList = (startDate, endDate) => {

	const fetchWithAuth = useFetchWithAuth();
	const [events, setEvents] = useState([]);

	useEffect(() => {
		if (!startDate || !endDate) {
			setEvents([]);
			return;
		}
		const query = `?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
		(async () => {
			try {
				const res = await fetchWithAuth(`/events`, query, {});
				if (!res.ok) throw new Error(`Status ${res.status}`);
				const data = await res.json();

				data.sort((a, b) => new Date(a.startStamp) - new Date(b.startStamp));
				setEvents(data.map((e) => ({ ...e, startStamp: new Date(e.startStamp), endStamp: new Date(e.endStamp) })));
			} catch {
				setEvents([]);
			}
		})();
	}, [fetchWithAuth, startDate, endDate]);

	return events;
};

