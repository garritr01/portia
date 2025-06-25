import React, { useState, useEffect } from 'react';
import { LeftMenu } from './views/LeftMenu';
import { useSwipe } from './helpers/DynamicView';
import { Login, Logout, useUser } from './contexts/UserContext';
import { useScreen } from './contexts/ScreenContext';
import { DayView, MonthView, YearView } from './views/Calendar';
import { useConnCheck, useAuthCheck } from './requests/Tests';
import { useFetchEvents, useFetchForms, useFetchSchedules, getAllRecurs } from './requests/Events';
import { useFetchChecklist } from './requests/Checklist';
import { returnDates, addTime } from './helpers/DateTimeCalcs';

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
	const [selectedDate, setSelectedDate] = useState(new Date());
	// Array containing each date in view
	const [days, setDays] = useState([]);
	const startDate = days[0] ?? null ;
	const endDate = days[days.length - 1] ?? null;
	// Alter date range when necessary
	useEffect(() => {
		//console.log('left exp:', leftExpanded, 'smallScreen:', smallScreen);
		setDays((smallScreen || leftExpanded) ? [selectedDate] : returnDates(selectedDate, 'day'));
		if ((smallScreen || leftExpanded) && span !== 'day') { setSpan('day') }
	}, [selectedDate, span, smallScreen, leftExpanded]);

	// Fetch and update state of calendar objects
	const fetchEvents = useFetchEvents(startDate, endDate);
	const fetchForms = useFetchForms();
	const fetchSchedules = useFetchSchedules(startDate, endDate);
	const [events, setEvents] = useState([]);
	const [forms, setForms] = useState([]);
	const [schedules, setSchedules] = useState([]);
	const [recurs, setRecurs] = useState([]);
	//useEffect(() => console.log("events: ", events), [events]);
	//useEffect(() => console.log("forms: ", forms), [forms]);
	//useEffect(() => console.log("schedules: ", schedules), [schedules]);
	//useEffect(() => console.log("recurs: ", recurs), [recurs]);
	//useEffect(() => console.log("days: ", days), [days]);
	
	useEffect(() => {
		if (!user || !startDate || !endDate) { 
			setEvents([]);
			return;	 
		}
		fetchEvents(startDate, endDate)
			.then(setEvents)
			.catch(() => setEvents([]));
	}, [fetchEvents, startDate, endDate]);

	useEffect(() => {
		if (!user) {
			setForms([]);
			return;
		}
		fetchForms()
			.then(setForms)
			.catch(() => setForms([]));
	}, [fetchForms]);

	useEffect(() => {
		if (!user) {
			setSchedules([]);
			return;
		}
		fetchSchedules()
			.then(setSchedules)
			.catch(() => setSchedules([]));
	}, [fetchSchedules]);

	useEffect(() => {
		if (!user) {
			setRecurs([]);
		}
		const newRecurs = getAllRecurs(schedules, startDate, endDate);
		if (newRecurs) {
			setRecurs(newRecurs);
		} else {
			setRecurs([]);
		}
	}, [schedules, startDate, endDate]);


	// --- CHECKLIST HANDLERS --------------------------------------------------------------
	// Define checklist items
	const [checklist, setChecklist] = useState([]);
	const fetchChecklist = useFetchChecklist();
	useEffect(() => {
		if (!user) { 
			setChecklist([]);
			return;
		 }
		fetchChecklist()
			.then(setChecklist)
			.catch(() => setChecklist([]));
	}, [fetchChecklist]);

	// --- FORM HANDLERS -------------------------------------------------------------------
	// Define user input forms
	const [form, setForm] = useState({ path: '', content: [], startTime: null, endTime: null });

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
						checklist={checklist}
						setChecklist={setChecklist}
						leftExpanded={leftExpanded}
						smallScreen={smallScreen}
					/>
					{!smallScreen && <button className="resizer" onClick={() => setLeftExpanded(!leftExpanded)}>||</button>}
					<div className={`calendar ${!leftExpanded ? 'expand' : ''}`}>
						{smallScreen && <button className="hamburger" onClick={() => setLeftExpanded(true)}>☰</button>}
						{span === 'year' ? 
							<YearView 
								selectedDate={selectedDate} 
								onMonthClick={onCellClick}
								form={form}
								setForm={setForm} />
							: span === 'month' ? 
							<MonthView 
								selectedDate={selectedDate} 
								onDayClick={onCellClick}
								form={form}
								setForm={setForm} />
							: span === 'day' ? 
							<DayView 
									events={events}
									setEvents={setEvents}
									forms={forms}
									setForms={setForms}
									recurs={recurs}
									setRecurs={setRecurs}
									schedules={schedules}
									setSchedules={setSchedules}
									selectedDate={selectedDate}
									days={days}
									onDayClick={onCellClick}
									leftExpanded={leftExpanded}
									span={span}
								/>
							: <p>Not sure how you got here.</p>
						}
					</div>
				</div>
			}
		</>
	);
};
