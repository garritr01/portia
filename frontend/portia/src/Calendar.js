import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useScreen, useUser } from './Contexts';
import { returnDates, addTime, timeDiff, normDate, monthLength, makeSafeDate } from './dateTimes';
import { useSwipe, DropSelect, invalidInputFlash } from './dynamicView';
import { useSave } from './Requests';

export const YearView = ({ selectedDate, onMonthClick, form, setForm }) => {
	const months = returnDates(selectedDate, 'year');
	const year = selectedDate.getFullYear();

	return (
		<>
			<div className="navigationBar">
				<button className="arrowButton" onClick={() => onMonthClick(addTime(selectedDate, { years: -1 }), 'year')}>❮❮❮</button>
				<button className="navButton">{year}</button>
				<button className="arrowButton" onClick={() => onMonthClick(addTime(selectedDate, { years: 1 }), 'year')}>❯❯❯</button>
			</div>
			<div className="yearView">
				{months.map((date, idx) => (
					<div key={idx} className="monthCell">
						<div className="monthTitle" onClick={() => onMonthClick(date, 'month')}>{date.toLocaleString('default', { month: 'long' })}</div>
						<div className="monthContent"></div>
					</div>
				))}
			</div>
		</>
	);
};

export const MonthView = ({ selectedDate, onDayClick, form, setForm }) => {
	const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const days = returnDates(selectedDate, 'month');
	const month = selectedDate.toLocaleString('default', { month: 'long' });
	const year = selectedDate.getFullYear();
	const weeksToRender = days.slice(35).some(date => date.getMonth() === selectedDate.getMonth()) ? 6 : 5;

	return (
		<>
			<div className="navigationBar">
				<button className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { months: -1 }), 'month')}>❮❮❮</button>
				<button className="navButton" onClick={() => onDayClick(selectedDate, 'year')}>{year}</button>
				<button className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { months: 1 }), 'month')}>❯❯❯</button>
			</div>
			<div className="monthView">
				<div className="weekdayTitle">{month}</div>
				<div className="weekdayRow">
					{weekdays.map((day, idx) => (
						<div key={idx} className="weekdayTitle">{day}</div>
					))}
				</div>
				{Array.from({ length: weeksToRender }).map((_, weekIdx) => (
					<div key={weekIdx} className="monthRow">
						{days.slice(weekIdx * 7, (weekIdx + 1) * 7).map((date, idx) => (
							<div key={idx} className="gridDayCell">
								<div className="gridDayTitle" onClick={() => onDayClick(date, 'day')}>{date.getDate()}</div>
								<div className="gridDayContent"></div>
							</div>
						))}
					</div>
				))}
			</div>
		</>
	);
};

export const DayView = ({ selectedDate, days, events, onDayClick, form, setForm, leftExpanded }) => {
	const { smallScreen = false } = useScreen() || {};
	const month = selectedDate.toLocaleString('default', { month: 'long' });
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
	const [tempDate, setTempDate] = useState(new Date(selectedDate));
	const [tempDotM, setTempDotM] = useState(selectedDate.getDate());
	const [showForm, setShowForm] = useState(Array.from({ length: days.length }, () => (false)));
	
	useEffect(() => {setTempDate(selectedDate);}, [selectedDate])
	useSwipe({
		onSwipeLeft: smallScreen && !leftExpanded ? () => onDayClick(addTime(selectedDate, { days: 1 }), 'day') : null,
		onSwipeRight: smallScreen && !leftExpanded ? () => onDayClick(addTime(selectedDate, { days: -1 }), 'day') : null,
	});
	
	const handleMonthChange = (newMonth) => {
		setTempDate(prev => {
			const d = new Date(prev);
			const desiredDay = tempDotM;
			d.setDate(1); // Prevent rollover
			d.setMonth(newMonth);
			const daysInMonth = monthLength(d);
			d.setDate(Math.min(desiredDay, daysInMonth)); // Select tempDotM or endDotM
			return d;
		});
	};

	const handleYearChange = (newYear) => {
		setTempDate(prev => {
			const d = new Date(prev);
			const desiredDay = tempDotM;

			d.setDate(1);            // Reset to 1st of month first
			d.setFullYear(newYear);  // Now set the year safely
			const daysInMonth = monthLength(d);
			d.setDate(Math.min(desiredDay, daysInMonth)); // Set day to tempDotM or last valid day
			return d;
		});
	};

	const handleDayChange = (newDate) => {
		setTempDate(prev => {
			const d = new Date(prev);
			d.setDate(newDate);
			setTempDotM(newDate);
			return d;
		});
	};

	return (
		<>
			{smallScreen ?
				<div className="dateSelector">
					<DropSelect
						options={months.map((month, idx) => {
							return {
								display: month,
								value: idx
							};
						})}
						value={{ display: months[tempDate.getMonth()], value: tempDate.getMonth() }}
						onChange={handleMonthChange}
						/>
					<DropSelect 
						options={Array.from({ length: monthLength(tempDate) }, (_, idx) => {
							return {
								display: idx + 1,
								value: idx + 1
							};
						})}
						value={{ display: tempDate.getDate(), value: tempDate.getDate() }} 
						onChange={handleDayChange} 
						/>
					<DropSelect
						options={Array.from({ length: 100 }, (_, idx) => {
							return {
								display: idx + 2000,
								value: idx + 2000
							};
						})}
						value={{ display: tempDate.getFullYear(), value: tempDate.getFullYear() }}
						onChange={handleYearChange}
						/>
					<button
						onClick={() => {
							tempDate.setDate(tempDotM);
							onDayClick(tempDate, 'day');
						}}
						>
						❯❯❯
					</button>
				</div>
				:
				<div className="navigationBar">
					<button className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { days: -3 }), 'day')}>❮❮❮</button>
					<button className="navButton" onClick={() => onDayClick(selectedDate, 'month')}>{month}</button>
					<button className="arrowButton" onClick={() => onDayClick(addTime(selectedDate, { days: 3 }), 'day')}>❯❯❯</button>
				</div>
			}
			<div className="dayView">
				{days.map((date, idx) => (
					<div key={idx} className={idx === 2 ? 'dayCellLarge' : 'dayCellSmall'}>
						<div
							className={idx === 2 ? 'dayTitleLarge' : 'dayTitleSmall'}
							onClick={() => timeDiff(selectedDate, date).days !== 0 && onDayClick(date, 'day')}
							>
							<span>{date.toLocaleDateString('default', { weekday: 'short' })}</span>
							{smallScreen ?
								<span>{date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}</span>
								: <span>{date.toLocaleDateString('default', { day: 'numeric' })}</span>
							}
						</div>
						<div className={idx === 2 ? 'dayContentLarge' : 'dayContentSmall'}>
							<button className="createButton" onClick={() => 
								setShowForm(prev => {
									const show = [...prev];
									show[idx] = !show[idx]
									return show;
								})
							}>+</button>
							{events
								.filter(evt => {
									const start = new Date(evt.startStamp);
									const end = new Date(evt.endStamp);
									return (
										timeDiff(date, normDate(start)).days == 0 || 
										timeDiff(date, normDate(end)).days == 0 || 
										(start < date && date < end)
									);
								})
								.map(evt => (
									<div className="quickRow" key={evt.id}>
										<button className="submitButton" onClick={() => {
											setForm(evt);
											setShowForm(prev => {
												const show = [...prev];
												show[idx] = !show[idx]
												return show;
											});
										}}>{evt.title}</button>
										<p className="sep">
											{new Date(evt.startStamp).toLocaleString('default', {hour: "2-digit", minute: "2-digit", hour12: false})}
											-
											{new Date(evt.endStamp).toLocaleString('default', {hour: "2-digit", minute: "2-digit", hour12: false})}
										</p>
									</div>
								))
							}
							{showForm[idx] &&
								<Floater>
									<Event events={events} idx={idx} form={form} setForm={setForm} setShowForm={setShowForm} dates={days} />
								</Floater>
							}
						</div>
					</div>
				))}
			</div>
		</>
	);
};

const Floater = ({ children }) => {
	return createPortal(
		<div className="portal">{children}</div>,
		document.body
	);
}

const Event = ({ idx, form, setForm, setShowForm, dates }) => {
	const { user } = useUser();
	const save = useSave();
	const pad2 = n => String(n).padStart(2, '0');
	const pad4 = n => String(n).padStart(4, '0');
	const [includeStart, setIncludeStart] = useState(false);
	const [startParts, setStartParts] = useState({ hour: "", minute: "", month: "", day: "", year: "" });
	const [endParts, setEndParts] = useState({ ...startParts });
	const [error, setError] = useState('');
	const dateAtIdx = dates[idx];
	const start = form?.startStamp ?? null;
	const end = form?.endStamp ?? null;

	useEffect(() => {
		let newStart, newEnd;
		const now = new Date();

		if (start) {
			newStart = new Date(start);
			setIncludeStart(true);
		} else if (dateAtIdx) {
			newStart = new Date(dateAtIdx);
			newStart.setHours(now.getHours());
			newStart.setMinutes(now.getMinutes());
		} else {
			newStart = new Date()
		} if (end) {
			newEnd = new Date(end);
		} else if (dateAtIdx) {
			newEnd = new Date(dateAtIdx);
			newEnd.setHours(now.getHours());
			newEnd.setMinutes(now.getMinutes());
		} else {
			newEnd = new Date();
		}

		setStartParts({
			hour: pad2(newStart.getHours()),
			minute: pad2(newStart.getMinutes()),
			month: pad2(newStart.getMonth() + 1),
			day: pad2(newStart.getDate()),
			year: pad4(newStart.getFullYear()),
		});
		setEndParts({
			hour: pad2(newEnd.getHours()),
			minute: pad2(newEnd.getMinutes()),
			month: pad2(newEnd.getMonth() + 1),
			day: pad2(newEnd.getDate()),
			year: pad4(newEnd.getFullYear()),
		});
	}, [dateAtIdx, start, end])


	const handleSubmit = async () => {
		setError("");
		if (!user) {
			setError("You must be signed in.");
			return;
		}

		let startDt, endDt;
		try {
			startDt = makeSafeDate(startParts);
			endDt = makeSafeDate(endParts);
		} catch (err) {
			invalidInputFlash(err.message.includes("start") ? "start" : "end");
			setError(err.message);
			return;
		}
		if (endDt < startDt) {
			invalidInputFlash("end");
			setError("End must be after start");
			return;
		}

		try {
			const saved = await save(
				form.id
					? `/events/${form.id}`
					: "/events",
				{
					dir: form.dir,
					title: form.title,
					content: form.content,
					startStamp: startDt.toISOString(),
					endStamp: endDt.toISOString(),
				}
			);

			console.log("Saved:", saved);
			setForm({ title: '', dir: '', content: [], startTime: null, endTime: null });
			setStartParts({ ...startParts });
			setEndParts({ ...startParts });
			setError("");
			setIncludeStart(false);
			setShowForm(prev => prev.map((val, i) => (i === idx ? !val : val)));
		} catch (err) {
			console.error(err);
			setError(err.message);
		}
	};

	const addElement = (type) => {
		if (type === 'text' || type === 'input') {
			setForm(prev => ({
				...prev,
				info: [...prev.info, { type: type, label: '', content: '' }]
			}))
		}
	}

	return (
		<div className="quickForm">
			<div className="quickRow">
				<input
					className="quickRow"
					placeholder="Event Directory"
					value={form.dir}
					onChange={e => setForm(prev => ({ ...prev, dir: e.target.value }))}
				/>
				<input
					className="quickRow"
					placeholder="Event Title"
					value={form.title}
					onChange={e => setForm(prev => ({...prev, title: e.target.value}))}
				/>
				<button className="submitButton" onClick={() => {
					setIncludeStart(false);
					setShowForm(prev => prev.map((val, i) => (i === idx ? !val : val)));
				}}>Close</button>
				<button className="submitButton" onClick={handleSubmit}>Schedule</button>
			</div>

			<div className='quickRow'>
				<button className="submitButton" onClick={() => setIncludeStart(!includeStart)}>
					{includeStart ? 'Remove Start' : 'Add Start'}
				</button>
				<button className="submitButton" onClick={() => addElement('text')}>Add Notes</button>
			</div>

			<InteractiveForm content={form.content} setForm={setForm} />

			{includeStart && <InteractiveTime type={'Start'} parts={startParts} setParts={setStartParts} />}
			<InteractiveTime type={'End'} parts={endParts} setParts={setEndParts} />

		</div>
	);
};

const InteractiveForm = ({ content, setForm }) => {

	const editForm = (idx, key, e) => {
		const newValue = e.target.value;
		setForm(prev => ({
			...prev,
			content: prev.content.map((elmt, i) =>
				i === idx
					? { ...elmt, [key]: newValue }
					: elmt
			)
		}));
	};

	return (
		<>
			{content.map((field, idx) => {
				const {
					type    = "No type!",
					label   = "",
					content = ""
				} = field;

				return (
					<React.Fragment key={field.key ?? idx}> {/* fragment is <></> but with props */}
						<div className="quickRow" id="endDateTime">
							<p className="quickCell sep">{type} element -</p>
							<p className="quickCell sep">label: </p>
							<input
								className="quickCell"
								value={label}
								onChange={e => editForm(idx, "label", e)}
							/>
						</div>

						{type === "text" && (
							<textarea
								style={{ width: "100%", resize: "vertical" }}
								placeholder="Type your content here..."
								value={content}
								onChange={e => editForm(idx, "content", e)}
							/>
						)}
					</React.Fragment>
				);
			})}
		</>
	);
};

const InteractiveTime = ({ type, parts, setParts }) => {
	return (
		<div className="quickRow" id="endDateTime">
			<p className='quickCell sep'>{type}</p>
			{['month', 'day', 'year', 'hour', 'minute'].map(key => {
				const maxLength = key === 'year' ? 4 : 2;
				const class2 = key === 'year' ? 'year' : 'time';
				const after = (
					(key === 'month' || key === 'day') ? '/'
					: (key === 'year') ? '@'
					: (key === 'hour') ? ':' 
					: 'EST'
				);
				return (
					<div className='quickCell' key={key}>
						<input
							className={class2}
							placeholder={key.toUpperCase()}
							maxLength={maxLength}
							value={parts[key]}
							onChange={e =>
								setParts(prev => ({ ...prev, [key]: e.target.value }))
							}
						/>
						<p className="sep">{after}</p>
					</div>
				);
			})}
		</div>
	)
};

