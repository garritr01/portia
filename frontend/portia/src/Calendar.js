import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from './user/Auth';
import {
	addTime, getDayOfWeek, normDate,
} from './dateTimes';

export const Calendar = () => {
	const { user } = useContext(UserContext);
	const [ activeDate, setActiveDate ] = useState(null);
	const [ baseDate, setBaseDate ] = useState(normDate(new Date()));
	const [ viewRange, setViewRange ] = useState([]);

	useEffect(() => {
		if (activeDate) {
			setBaseDate(activeDate);
			defineViewDates(activeDate, 'week');
		}
	}, [activeDate]);

	useEffect(() => {
		defineViewDates(baseDate, 'week');
	}, [baseDate])

	const defineViewDates = (jsDate, type) => {
		const days = [];
		if (type === 'week') {
			/** Start at Sunday preceding or equal to the first of the month */
			let currentDate = addTime(new Date(jsDate), { days: -(getDayOfWeek(new Date(jsDate)) + 7) });
			/** End at Saturday after or equal to the last of the month */
			while (currentDate < addTime(new Date(jsDate), { days: (7 - getDayOfWeek(new Date(jsDate))) + 7 })) {
				days.push(new Date(currentDate));
				currentDate.setDate(currentDate.getDate() + 1);
			}
		} else if (type === 'month') {
			/** Start at Sunday preceding or equal to the first of the month */
			const firstOfMonth = new Date(new Date(jsDate).setDate(1));
			console.log(`first: ${firstOfMonth.toLocaleDateString()}`)
			let currentDate = addTime(firstOfMonth, { days: -(getDayOfWeek(firstOfMonth)) });
			const firstOfNextMonth = new Date(new Date(jsDate).setMonth(new Date(jsDate).getMonth() + 1));
			/** End at Saturday after or equal to the last of the month */
			while (currentDate < addTime(new Date(jsDate), { days: (7 - getDayOfWeek(firstOfNextMonth)) + 7 })) {
				days.push(new Date(currentDate));
				currentDate.setDate(currentDate.getDate() + 1);
			}
		} else if (type === 'day') {
			days.push(new Date(jsDate));
		}
		setViewRange(days);
	}

	return (
		<div className="calendarContainer">
			<div className="topRightButtons">
				<button onClick={() => defineViewDates(baseDate, 'day')}>Day</button>
				<button onClick={() => defineViewDates(baseDate, 'week')}>Week</button>
				<button onClick={() => defineViewDates(baseDate, 'month')}>Month</button>
			</div>
			<div className="calendar">
				{viewRange &&
					Array.from({ length: Math.ceil(viewRange.length / 7) }, (_, rowIndex) => {
						const start = rowIndex * 7;
						const end = start + 7;
						const week = viewRange.slice(start, end); // Get the chunk for this week

						return (
							<div key={rowIndex} className="calendarRow">
								{week.map((day, index) => (
									<Cell
										setActiveDate={setActiveDate}
										day={day}
									/>
								))}
							</div>
						);
					})
				}
			</div>
		</div>
	)
}

const Cell = ({ setActiveDate, day }) => {

	return (
		<div className="cell">
			<div onClick={() => setActiveDate(day)}>
				<p>{getDayOfWeek(day, false)}</p> 
				<p>{day.toLocaleDateString()}</p>
			</div>
			<div>
				<p>1</p>
				<p>2</p>
			</div>
		</div>
	)
}

const ActiveCell = ({ setActiveDate, day }) => {

}