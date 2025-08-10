// components/CompositeForm.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
	FiX,
	FiCalendar,
	FiFileText,
	FiRotateCcw,
	FiCheckSquare,
	FiSave,
	FiCheckCircle,
	FiCheck,
	FiEdit,
	FiUpload
} from 'react-icons/fi';
import { validateForm, validateEvent, validateSchedule } from '../helpers/InputValidation';
import {
	addTime,
	editFriendlyDateTime,
	calcFriendlyDateTime,
	viewFriendlyDateTime,
	periodOptions,
	weekdayOptions,
	monthOptions,
	monthLength,
} from '../helpers/DateTimeCalcs';
import { v4 as uuid } from 'uuid';
import { dropKeys, assignKeys } from '../helpers/Misc';
import { makeEmptySchedule } from '../helpers/HandleComposite';
import { ErrorInfoButton, invalidInputFlash } from './Notifications';
import { DropSelect, InfDropSelect } from './Dropdown';

export const InteractiveTime = ({ text, type, objKey, schedIdx = null, fieldKey, date, errorInfo, reduceComposite, syncStartAndEnd, setSyncStartAndEnd }) => {
	const [rawParts, setRawParts] = useState(editFriendlyDateTime(null));
	const [format, setFormat] = useState({ order: [] });

	// define rawParts with date object
	useEffect(() => setRawParts(editFriendlyDateTime(date)), [date]);

	// set format with type arg
	useEffect(() => {
		if (type === 'weekly') {
			setFormat({
				order: ['weekday', 'hour', 'minute'],
				weekday: '@',
				hour: ':',
				minute: ''
			});
		} else {
			setFormat({
				order: ['month', 'day', 'year', 'hour', 'minute'],
				month: '/',
				day: '/',
				year: '@',
				hour: ':',
				minute: ''
			});
		}
	}, [type]);

	const commitPart = (unit, newVal) => {
		try {
			if (unit === 'hour' && parseInt(newVal) > 23) {
				invalidInputFlash(`${objKey}_${fieldKey}_${unit}Input`);
			} else if (unit === 'minute' && parseInt(newVal) > 59) {
				invalidInputFlash(`${objKey}_${fieldKey}_${unit}Input`);
			}
			const upDate = calcFriendlyDateTime(unit, date, { ...rawParts, [unit]: newVal });
			const validUpDate = !isNaN(upDate.getTime())
			if (!validUpDate) {
				setRawParts(editFriendlyDateTime(date));
			}
			if (objKey === 'event') {
				// 'event' case
				//console.log([objKey, fieldKey], upDate);
				if (validUpDate) {
					reduceComposite({ type: 'drill', path: [objKey, fieldKey], value: upDate });
					// Handle syncing of start and end datetimes
					if (syncStartAndEnd.eventStart && fieldKey === 'endStamp') { reduceComposite({ type: 'drill', path: [objKey, 'startStamp'], value: upDate }) }
					if (syncStartAndEnd.eventEnd && fieldKey === 'startStamp') { reduceComposite({ type: 'drill', path: [objKey, 'endStamp'], value: upDate }) }
				} else {
					invalidInputFlash(`${objKey}_${fieldKey}_${unit}Input`);
				}
				// Handle ending sync
				if (fieldKey === 'endStamp') { setSyncStartAndEnd(prev => ({ ...prev, eventEnd: false })) }
				if (fieldKey === 'startStamp') { setSyncStartAndEnd(prev => ({ ...prev, eventStart: false })) }
			} else if (objKey === 'schedules') {
				// 'schedules' case
				//console.log([objKey, schedIdx, fieldKey], upDate);
				if (validUpDate) {
					reduceComposite({ type: 'drill', path: [objKey, schedIdx, fieldKey], value: upDate });
					// Handle syncing of datetimes
					if (syncStartAndEnd.scheduleEnd && fieldKey === 'startStamp') {
						reduceComposite({ type: 'drill', path: [objKey, schedIdx, 'endStamp'], value: upDate });
						if (syncStartAndEnd.scheduleUntil) { 
							reduceComposite({ type: 'drill', path: [objKey, schedIdx, 'until'], value: upDate });
						}
					} 
					if (syncStartAndEnd.scheduleUntil && fieldKey === 'endStamp') { 
						reduceComposite({ type: 'drill', path: [objKey, schedIdx, 'until'], value: upDate });
					}
				} else {
					invalidInputFlash(`${objKey}_${fieldKey}_${unit}Input`);
				}
				// Handle ending sync
				if (fieldKey === 'endStamp') { setSyncStartAndEnd(prev => ({ ...prev, scheduleEnd: false })) } 
				if (fieldKey === 'until') { setSyncStartAndEnd(prev => ({ ...prev, scheduleUntil: false })) }
			} else {
				console.warn("Unexpected combination of objKey and schedIdx: ", objKey, schedIdx);
			}
		} catch (err) {
			console.exception(`Erred committing ${newVal} to ${unit} in InteractiveTime`);
		}
	}

	const createDefaults = (unit) => {
		if (unit === 'weekday') { return weekdayOptions[Number(rawParts[unit])] }
		if (unit === 'month') { return monthOptions[Number(rawParts[unit]) - 1] }
		if (unit === 'day') { return { display: rawParts[unit], value: Number(rawParts[unit]) } }
		if (unit === 'hour') { return { display: rawParts[unit], value: Number(rawParts[unit]) } }
		if (unit === 'minute') { return { display: rawParts[unit], value: Number(rawParts[unit]) } }
		return { display: 'No Options', value: 0 };
	}

	const createOptions = (unit) => {
		if (unit === 'weekday') { return weekdayOptions }
		if (unit === 'month') { return monthOptions }
		if (unit === 'day') { return Array.from({ length: monthLength(date) }, (_, idx) => ({ display: String(idx + 1), value: (idx + 1) })) }
		if (unit === 'hour') { return Array.from({ length: 24 }, (_, idx) => ({ display: String(idx), value: idx })) }
		if (unit === 'minute') { return Array.from({ length: 60 }, (_, idx) => ({ display: String(idx), value: idx })) }
		return [{ display: 'No Options', value: 0 }];
	}

	return (
		<div id={fieldKey} className={errorInfo?.err ? "navRow erred" : "navRow"}>
			<p className="sep">{text}</p>
			{date && format.order.map((unit) => (
				<React.Fragment key={`${fieldKey}_${unit}`}>
					<div className="navCell">
						{unit === 'year' ?
								<InfDropSelect
									dropHeaderID={`${objKey}_${fieldKey}_${unit}Input`}
									value={{ display: String(date.getFullYear()), value: date.getFullYear() }}
									setter={(newVal) => commitPart(unit, newVal)}
									allowType={true}
								/>
								:
								<DropSelect
									dropHeaderID={`${objKey}_${fieldKey}_${unit}Input`}
									options={createOptions(unit)}
									value={createDefaults(unit)}
									setter={(newVal) => commitPart(unit, newVal)}
									allowType={!(['weekday', 'month'].includes(unit))}
									numericOnly={['day', 'hour', 'minute'].includes(unit)}
								/>
							}
					</div>
					<p className="sep">{format[unit]}</p>
				</React.Fragment>
			))}
			{fieldKey === 'until' &&
				<button
					className={`relButton ${!date ? 'selected' : ''}`}
					onClick={() => {
						if (!date) {
							setSyncStartAndEnd(prev => ({ ...prev, scheduleUntil: true }));
							reduceComposite({ type: 'drill', path: [objKey, schedIdx, 'until'], value: new Date() });
						} else {
							setSyncStartAndEnd(prev => ({ ...prev, scheduleUntil: false }));
							reduceComposite({ type: 'drill', path: [objKey, schedIdx, 'until'], value: null });
						}
					}}
					>
					Forever
				</button>
			}
			<ErrorInfoButton {...errorInfo} />
		</div>
	)
}

const ScheduleForm = ({ editSchedule, setEditSchedule, schedule, errors, reduceComposite, syncStartAndEnd, setSyncStartAndEnd }) => {

	const handleCommitSchedule = () => {
		// Push endStamp a week forward if weekly and before start stamp (hack to allow weekly event sat -> sun etc)
		const valid = validateSchedule(schedule);
		reduceComposite({ type: 'update', errors: { ...errors, schedules: valid.validity } });
		if (!valid.isValid) {
			return;
		}
		const pushEndByWeek = schedule.period === 'weekly' && schedule.endStamp < schedule.startStamp;
		const newSchedule = {
			...schedule,
			endStamp: pushEndByWeek ? addTime(schedule.endStamp, { days: 7 }) : schedule.endStamp,
		};
		reduceComposite({ type: 'drill', path: ['schedules', editSchedule], value: newSchedule });
		setEditSchedule(null);
	};

	return (
		<div className="navBlock wButtonRow">
			<strong>New Schedule</strong>

			{/** PERIOD */}
			<div className="navRow">
				<p className="sep">Period</p>
				<div id="period" className="navCell">
					<DropSelect
						dropHeaderID={"periodInput"}
						options={periodOptions}
						value={periodOptions.find((option) => schedule.period === option.value)}
						setter={(newVal) => reduceComposite({
							type: 'drill',
							path: ['schedules', editSchedule, 'period'],
							value: newVal
						})}
						errorInfo={{ errID: "period", err: errors?.period?.err }}
					/>
				</div>
			</div>

			{/** INTERVAL */}
			<div className="navRow">
				{schedule.period && schedule.period !== 'single' &&
					<>
						<p className="sep">Every</p>
						<div id="interval" className={errors?.interval?.err ? "navCell errCell" : "navCell"}>
							<InfDropSelect
								dropHeaderID={"intervalInput"}
								min={1}
								value={{ display: String(schedule.interval), value: schedule.interval }} // Just so I can use the same View for both DropSelects
								setter={(newVal) => reduceComposite({
									type: 'drill',
									path: ['schedules', editSchedule, 'interval'],
									value: Number(newVal)
								})}
								allowType={true}
								errorInfo={{ errID: "interval", err: errors?.interval?.err }}
							/>
						</div>
						<p className="sep">
							{periodOptions.find((opt) => opt.value === schedule.period)?.altDisplay || ''}
							{schedule.interval > 1 && 's'}
						</p>
					</>
				}
			</div>

			{/** ANCHOR EVENT */}
			{schedule.period &&
				<div className="navBlock">
					{schedule.period !== "single" && <strong>Anchor Event</strong>}
					<InteractiveTime
						text={'Start'}
						type={schedule.period}
						objKey={'schedules'}
						schedIdx={editSchedule}
						fieldKey={'startStamp'}
						date={new Date(schedule.startStamp)}
						reduceComposite={reduceComposite}
						errorInfo={{ errID: "startStamp", err: errors?.startStamp?.err }}
						syncStartAndEnd={syncStartAndEnd}
						setSyncStartAndEnd={setSyncStartAndEnd}
					/>
					<InteractiveTime
						text={'End'}
						type={schedule.period}
						objKey={'schedules'}
						schedIdx={editSchedule}
						fieldKey={'endStamp'}
						date={new Date(schedule.endStamp)}
						reduceComposite={reduceComposite}
						errorInfo={{ errID: "endStamp", err: errors?.endStamp?.err }}
						syncStartAndEnd={syncStartAndEnd}
						setSyncStartAndEnd={setSyncStartAndEnd}
					/>
				</div>
			}

			{/** EFFECTIVE RANGE */}
			{schedule.period && schedule.period !== 'single' &&
				<div className="navBlock">
					<strong>Until</strong>
					<InteractiveTime
						text={'Until'}
						objKey={'schedules'}
						schedIdx={editSchedule}
						fieldKey={'until'}
						date={schedule.until ? new Date(schedule.until) : schedule.until}
						reduceComposite={reduceComposite}
						errorInfo={{ errID: "until", err: errors?.until?.err }}
						syncStartAndEnd={syncStartAndEnd}
						setSyncStartAndEnd={setSyncStartAndEnd}
					/>
				</div>
			}

			{/** REVERT OR COMMIT */}
			<div className="submitRow right">
				<FiCheckSquare className="submitButton" onClick={() => handleCommitSchedule()} />
			</div>

		</div>
	);
}

const SchedulePreview = ({ schedules, reduceComposite, setEditSchedule }) => {

	return (
		<div className="form">
			<div className="formRow"><strong className="formCell">Schedules</strong></div>
			{schedules.map((rule, idx) =>
				rule.period && (
					<div className="form wButtonRow">
						<div className="submitRow right">
							<FiEdit className="submitButton" onClick={() => setEditSchedule(idx)}/>
							<FiX className="submitButton" onClick={() => reduceComposite({ type: 'update', schedules: schedules.filter((_, i) => i !== idx) })}/>
						</div>
						<div className="formRow">
							<strong className="formCell">Anchor:</strong>
							<p className="formCell">{viewFriendlyDateTime(rule.startStamp)}</p>
							<p className="formCell">-</p>
							<p className="formCell">{viewFriendlyDateTime(rule.endStamp, true)}</p>
						</div>
						{rule.period !== 'single' &&
							<div className="formRow">
								<strong className="formCell">Repeat:</strong>
								<p className="formCell">Every</p>
								{rule.interval > 1 ?
									<p className="formCell">{rule.interval}{periodOptions.find((opt) => opt.value === rule.period)?.altDisplay}s</p>
									: <p className="formCell">{periodOptions.find((opt) => opt.value === rule.period)?.altDisplay}</p>
								}		
								{rule.until && <p className="formCell">until {viewFriendlyDateTime(rule.until)}</p>}
							</div>
						}
					</div>
				)
			)}
		</div>
	);
}

const FormForm = ({ form, errors, changeField, reduceComposite }) => {

	// Implement drag and drop later
	const useFieldDrag = (fromIndex, toIndex) => {
		const infoCopy = [...form.info];
		const [movedField] = infoCopy.splice(fromIndex, 1);
		infoCopy.splice(toIndex, 0, movedField);
		reduceComposite({
			type: 'update',
			form: { ...form, info: infoCopy },
		});
	};

	const deleteField = (idx) => {
		const info = form.info.filter((_, i) => i !== idx);
		reduceComposite({
			type: 'update',
			form: { ...form, info },
		});
	};

	const addOption = (idx) => {
		if (form.info[idx].type !== 'mc') {
			console.warn("Cannot add option from non-mc field");
			return;
		}

		const optionsCopy = [...form.info[idx].options];
		reduceComposite({
			type: 'drill',
			path: ['form', 'info', idx, 'options'],
			value: [...optionsCopy, '']
		});
	};

	const removeOption = (fieldIdx, optIdx) => {
		if (form.info[fieldIdx].type !== 'mc') {
			console.warn("Cannot remove option from non-mc field");
			return;
		}

		const optionsCopy = [...form.info[fieldIdx].options];
		const updatedOptions = optionsCopy.filter((_, i) => i !== optIdx);
		reduceComposite({
			type: 'drill',
			path: ['form', 'info', fieldIdx, 'options'],
			value: updatedOptions
		});

		if (form.info[fieldIdx].baseValue === optionsCopy[optIdx]) {
			reduceComposite({
				type: 'drill',
				path: ['form', 'info', fieldIdx, 'baseValue'],
				value: null
			})
		}
	};

	return (
		form.info.map((f, idx) => (
			<React.Fragment key={idx}>
				<div className="navRow">
					<div id={`${idx}-label`} className={errors?.info?.[idx]?.label?.err ? "navCell erred" : "navCell"}>
						<input
							placeholder="Label..."
							value={f.label}
							onChange={e => changeField(['form', 'info', idx, 'label'], e.target.value)}
						/>
						<ErrorInfoButton errID={`${idx}-label`} err={errors?.info?.[idx]?.label?.err} />
					</div>
					{f.type === 'input' ?
						<React.Fragment>
							<div id={`${idx}-placeholder`} className={errors?.info?.[idx]?.placeholder?.err ? "navCell erred" : "navCell"}>
								<input
									placeholder="Placeholder..."
									value={f.placeholder}
									onChange={e => changeField(['form', 'info', idx, 'placeholder'], e.target.value)}
								/>
								<ErrorInfoButton errID={`${idx}-placeholder`} err={errors?.info?.[idx]?.placeholder?.err} />
							</div>
							<div id={`${idx}-baseValue`} className={errors?.info?.[idx]?.baseValue?.err ? "navCell erred" : "navCell"}>
								<input
									placeholder="Autofilled Value..."
									value={f.baseValue}
									onChange={e => changeField(['form', 'info', idx, 'baseValue'], e.target.value)}
								/>
								<ErrorInfoButton errID={`${idx}-baseValue`} err={errors?.info?.[idx]?.baseValue?.err} />
							</div>
						</React.Fragment>
						: f.type === 'tf' ?
							<>
								<button 
									className={`relButton ${f.baseValue === true ? 'selected' : ''}`}
									onClick={() => reduceComposite({ type: 'drill', path: ['form', 'info', idx, 'baseValue'], value: f.baseValue !== true ? true : null })}
									>
									True
								</button>
								<button 
									className={`relButton ${f.baseValue === false ? 'selected' : ''}`}
									onClick={() => reduceComposite({ type: 'drill', path: ['form', 'info', idx, 'baseValue'], value: f.baseValue !== false ? false : null })}
									>
									False
								</button>
							</>
							: null
					}
					<button className="relButton" onClick={() => deleteField(idx)}>×</button>
					{/* <button className="relButton" onPointerDown={() => startFieldDrag(idx)}>⇅</button> */}
				</div>
				{f.type === 'text' ?
					<div className="navRow">
						<div id={`${idx}-placeholder`} className={errors?.info?.[idx]?.placeholder?.err ? "navCell erred" : "navCell"}>
							<textarea
								placeholder="Placeholder..."
								value={f.placeholder}
								onChange={e => changeField(['form', 'info', idx, 'placeholder'], e.target.value)}
							/>
							<ErrorInfoButton errID={`${idx}-placeholder`} err={errors?.info?.[idx]?.placeholder?.err} />
						</div>
					</div>
					: f.type === 'mc' ?
						<div className="navRow">
							{f.options.map((opt, optIdx) => (
								<React.Fragment key={optIdx}>
									<div id={`${idx}-options-${optIdx}`} className={errors?.info?.[idx]?.options?.[optIdx]?.err ? "navCell erred" : "navCell"}>
										<input
											placeholder={`Option ${optIdx + 1}...`}
											value={opt}
											onChange={e => changeField(['form', 'info', idx, 'options', optIdx], e.target.value)}
										/>
										<ErrorInfoButton errID={`${idx}-options-${optIdx}`} err={errors?.info?.[idx]?.options?.[optIdx]?.err} />
									</div>
									<FiCheck className={`relButton ${f.baseValue === opt ? 'selected' : ''}`}
										onClick={() => reduceComposite({ type: 'drill', path: ['form', 'info', idx, 'baseValue'], value: f.baseValue === opt ? null : opt })} 
										/>
									<button className="relButton" onClick={() => removeOption(idx, optIdx)}>×</button>
								</React.Fragment>
							))}
							<button className="relButton" onClick={() => addOption(idx)}>+</button>
						</div>
						: null
				}
			</React.Fragment>
		))
	);
}

const EventForm = ({ event, form, errors, changeField, reduceComposite }) => {

	const addInput = (idx) => {
		if (event.info[idx].type !== 'input') {
			console.warn("Cannot add input from non-input field");
			return;
		}

		const contentCopy = [...event.info[idx].content];
		reduceComposite({
			type: 'drill',
			path: ['event', 'info', idx, 'content'],
			value: [...contentCopy, { value: form.info[idx].baseValue, key: uuid() }]
		});
	};

	const removeInput = (fieldIdx, inpKey) => {
		if (event.info[fieldIdx].type !== 'input') {
			console.warn("Cannot remove input from non-input field");
			return;
		}

		const contentCopy = [...event.info[fieldIdx].content];
		const updatedContent = contentCopy.filter(c => c.key !== inpKey);
		reduceComposite({
			type: 'drill',
			path: ['event', 'info', fieldIdx, 'content'],
			value: updatedContent
		});
	};

	return (
		event.info.map((f, idx) => (
			<React.Fragment key={idx}>
				<div className="navRow" key={idx}>
					<p className="sep">{f.label}</p>
					{f.type === 'input' ?
						<>
							{f.content.map((inp, inpIdx) => (
								<React.Fragment>
									<div id={`${inp.key}`} className={errors?.event?.info?.[idx]?.content?.[inpIdx]?.value?.err ? "navCell erred" : "navCell"}>
										<DropSelect
											dropHeaderID={`${inp.key}Input`}
											options={form.info[idx].suggestions.sort((a, b) => a.localeCompare(b)).map(sugg => ({ display: sugg, value: sugg }))}
											value={{ display: inp.value, value: inp.value }}
											setter={newVal => {
												changeField(['event', 'info', idx, 'content', inpIdx, 'value'], newVal);
											}}
											placeholder={form.info[idx].placeholder}
											allowType={true}
											realtimeUpdate={true}
											errorInfo={{ errID: `${inp.key}`, err: errors?.event?.info?.[idx]?.content?.[inpIdx]?.value?.err }}
										/>	
									</div>
									<div className="navCell" key={`${inp.key+'Remove'}`}>
										<button className="relButton" onClick={() => removeInput(idx, inp.key)}>x</button>
									</div>
								</React.Fragment>
							))}
							<div className="navCell">
								<button className="relButton" onClick={() => addInput(idx)}>+</button>
							</div>
						</>
						: f.type === 'tf' ?
							<React.Fragment>
								<div id={`${idx}-content`} className={errors?.event?.info?.[idx]?.content?.err ? "navCell erred" : "navCell"}>
									<button className={`relButton ${f.content === true ? 'selected' : ''}`}
										onClick={() => changeField(['event', 'info', idx, 'content'], f.content === true ? null : true)}>
										True
									</button>
								</div>
								<div id={`${idx}-content`} className={errors?.event?.info?.[idx]?.content?.err ? "navCell erred" : "navCell"}>
									<button className={`relButton ${f.content === false ? 'selected' : ''}`}
										onClick={() => changeField(['event', 'info', idx, 'content'], f.content === false ? null : false)}>
										False
									</button>
								</div>
								<ErrorInfoButton errID={`${idx}-content`} err={errors?.event?.info?.[idx]?.content?.err} />
							</React.Fragment>
							: null
					}
				</div>
				{f.type === 'text' ?
					<div className="navRow">
						<div id={`${idx}-content`} className={errors?.event?.info?.[idx]?.content[0]?.err ? "navCell wTextArea erred" : "navCell wTextArea"}>
							<textarea
								placeholder={form.info[idx].placeholder + '...'}
								value={f.content}
								onChange={e => changeField(['event', 'info', idx, 'content'], e.target.value)}
							/>
							<ErrorInfoButton errID={`${idx}-content`} err={errors?.event?.info?.[idx]?.content[0]?.err} />
						</div>
					</div>
					: f.type === 'mc' ?
						<div className="navRow">
							{form.info[idx].options.map((opt, optIdx) => (
								<div key={optIdx} id={`${idx}-content-${optIdx}`} className={errors?.event?.info?.[idx]?.options?.[optIdx]?.err ? "navCell erred" : "navCell"}>
									<button
										className={`relButton ${f.content === opt ? 'selected' : ''}`}
										onClick={() => changeField(['event', 'info', idx, 'content'], f.content === opt ? null : opt)}>
										{opt}
									</button>
									<ErrorInfoButton errID={`${idx}-content-${optIdx}`} err={errors?.event?.info?.[idx]?.options?.[optIdx]?.err} />
								</div>
							))}
						</div>
						: null
				}
			</React.Fragment>
		))
	);
}

export const CompositeForm = ({ allForms, allSchedules, composite, reduceComposite, upsertComposite, setShowForm }) => {

	const { form, event, schedules, dirty, errors } = composite;
	const [pendingSave, setPendingSave] = useState(false);
	const [suggPaths, setSuggPaths] = useState([{ display: '', value: '' }]);
	const [editSchedule, setEditSchedule] = useState(null);
	const schedule = editSchedule !== null ? schedules[editSchedule] : null;
	const [edit, setEdit] = useState(false);
	const [syncStartAndEnd, setSyncStartAndEnd] = useState({
		eventStart: !form.includeStart,
		eventEnd: true,
		scheduleEnd: true,
		scheduleUntil: true
	});

	//useEffect(() => console.log("form:\n", form), [form]);
	useEffect(() => console.log("event:\n", event), [event]);
	//useEffect(() => console.log("schedules:\n", schedules), [schedules]);
	//useEffect(() => console.log("dirty:\n", dirty), [dirty]);
	//useEffect(() => console.log("errors:\n", errors), [errors]);
	//useEffect(() => console.log("sync:\n", syncStartAndEnd), [syncStartAndEnd])

	// Holds last state for easy reversion
	const ogState = useRef({
		form: { ...form, info: [...form.info] },
		schedule: {},
	});

	// Ensure current schedule is truly the current schedule
	useEffect(() => {
		ogState.current.schedule = editSchedule !== null ? { ...schedules[editSchedule] } : {};
		//console.log('ogSched:', editSchedule !== null ? { ...schedules[editSchedule] } : {});
	}, [editSchedule]);

	// Ensure event sync start with end corresponds to form.includeStart
	useEffect(() => {
		setSyncStartAndEnd(prev => ({ ...prev, eventStart: !form.includeStart }));
	}, [form.includeStart]);

	// For warning about misdefined values
	/*
	useEffect(() => {
		console.log("Triggered warning useEffect");
		event.info.forEach((f, idx) => {
			if (f.type === 'text' && typeof(f.content) !== 'string') {
				console.warn(`Text content at idx ${idx} not string: `, typeof(f.content), f.content);
			} else if (f.type === 'input') {
				if (!Array.isArray(f.content)) {
					console.warn(`Input content at idx ${idx} not object: `, typeof(f.content), f.content);
				} else {
					f.content.forEach((val, jdx) => {
						if (typeof(val) !== 'string') {
							console.warn(`Input content at idx ${idx}, ${jdx} not string: `, typeof(f.content), f.content);
						}
					});
				}
			}
		});
		form.info.forEach((f, idx) => {
			if (f.type === 'text') {
				if (f.baseValue) {
					console.warn(`Text contains base value`, typeof (f.baseValue), f.baseValue);
				} 
			} else if (f.type === 'input') {

				if (!Array.isArray(f.content)) {
					console.warn(`Input content at idx ${idx} not array: `, typeof (f.content), f.content);
				} else {
					f.content.forEach((val, jdx) => {
						if (typeof (val) !== 'string') {
							console.warn(`Input content at idx ${idx}, ${jdx} not string: `, typeof (f.content), f.content);
						}
					});
				}

				if (!f?.suggestions) {
					console.warn(`No suggestions at idx ${idx}.`);
				} else if (!Array.isArray(f.suggestions)) {
					console.warn(`Input suggestions at idx ${idx} not array: `, typeof (f.suggestions), f.suggestions);
				} else {
					f.suggestions.forEach((val, jdx) => {
						if (typeof (val) !== 'string') {
							console.warn(`Input suggestions at idx ${idx}, ${jdx} not string: `, typeof (f.suggestions), f.suggestions);
						}
					});
				}
			} else if (f.type === 'mc') {
				if (!f?.options) {
					console.warn(`mc at idx ${idx} has no options`);
				} else if (!Array.isArray(f.options)) {
					console.warn(`Input options at idx ${idx} not array: `, typeof (f.options), f.options);
				} else {
					f.options.forEach((val, jdx) => {
						if (typeof (val) !== 'string') {
							console.warn(`Input option at idx ${idx}, ${jdx} not string: `, typeof(val), val);
						}
					});
				}
				if (!f?.baseValue || f.baseValue !== null || typeof(f.baseValue) !== 'string') {
					console.warn(`mc base value not null or string at ${idx}`, typeof(f?.baseValue), f?.baseValue);
				}
			}
		});
	}, [form, event]);
	*/

	// Handle dynamic path for form loading
	useEffect(() => {
		//console.log(`Finding suggested paths with:`, form.path);
		//console.log('available paths:', allForms.map(f => f.path));
		const formPathLength = form.path.split('/').length;
		const filteredPaths = allForms.map(f => f.path)
			.filter(p => p.startsWith(form.path))
			.map(p => {
				const pSplit = p.split('/');
				const pSliced = pSplit.slice(0, formPathLength);
				const pTrimmed = pSliced.join('/');
				if (pTrimmed === form.path && pSplit.length > formPathLength) {
					return pSplit.slice(0, formPathLength + 1).join('/');
				} else {
					return pTrimmed;
				}
			});
		const uniquePaths = Array.from(new Set(filteredPaths))
			.sort((a, b) => a.localeCompare(b))
			.map(p => ({ display: p, value: p }));
		//console.log('suggested paths:', uniquePaths);
		setSuggPaths(uniquePaths);
	}, [form.path]);

	// Update event info for filling out based on form info without removing event content already present
	const updateEventUI = (updatedFormInfo) => {
		const updatedEventInfo = updatedFormInfo.map((f, idx) => {
			const prevEvent = event.info.find(e => (e.label === f.label && 'content' in e));
			const { baseValue, suggestions, placeholder, options, ...cleanedF } = f;
			if (prevEvent) {
				return { ...cleanedF, content: prevEvent.content };
			} else {
				const emptyContent = 
					(f.type === 'input') ? [baseValue ? baseValue : '']
					: (f.type === 'text') ? ''
					: baseValue ? baseValue
					: null;
				console.log(`Setting ${f.type} content at ${idx} to: `, emptyContent);
				return { ...cleanedF, content: emptyContent }
			}
		});
		const newEvent = assignKeys({ ...event, info: updatedEventInfo });
		reduceComposite({
			type: 'update',
			event: newEvent
		})
	};

	// Update schedules to include a new one autofilling based on previous or event timestamps
	const handleCreateSchedule = () => {
		if (editSchedule === null) {
			const lastSched = schedules.length > 0 ? schedules[schedules.length - 1] : null;
			setSyncStartAndEnd(prev => ({ ...prev, scheduleEnd: true, scheduleUntil: lastSched?.until ? true : false }))
			setEditSchedule(schedules.length);
			const newSchedule = {
				...makeEmptySchedule(event.path),
				startStamp: lastSched ? lastSched.startStamp : event.startStamp,
				endStamp: lastSched ? lastSched.endStamp : event.endStamp,
				until: lastSched ? lastSched.until : event.endStamp
			};
			reduceComposite({ type: 'drill', path: ['schedules', schedules.length], value: newSchedule });
		} else {
			handleRevertSchedule();
		}
	}

	// Reset to last committed state
	const handleRevertSchedule = () => {
		// Revert if ogState is not empty, otherwise delete
		const old = ogState.current.schedule;
		if (old.period) {
			console.log("Reverting existing og schedule.")
			reduceComposite({
				type: 'drill',
				path: ['schedules', editSchedule],
				value: old,
			});
		} else {
			console.log("Reverting absent og schedule.")
			reduceComposite({ type: 'update', schedules: schedules.filter((_, i) => i !== editSchedule) });
		}
		setEditSchedule(null);
	};

	const handleRevertForm = () => {
		reduceComposite({ type: 'update', form: ogState.current.form });
		setEdit(false);
	};

	const handleCommitForm = () => {
		const valid = validateForm(form);
		reduceComposite({ type: 'update', errors: { ...errors, form: valid.validity } });
		if (!valid.isValid) {
			console.warn("Form validation failed:", valid);
			return;
		}
		ogState.current.form = {
			...form,
			info: [...form.info]
		};
		setEdit(false);
		updateEventUI(form.info);
	};

	// Update suggestions in form on event save
	const updateSuggestions = () => {
		const inputContent = event.info.map(f => {
			if (f.type === 'input') {
				return f.content;
			} else {
				return null;
			}
		});
		inputContent.forEach((content, idx) => {
			if (content === null) { return }
			let newEntries = [];
			content.forEach((entry) => {
				if (
					entry.value
					&& typeof entry.value !== 'number'
					&& !form.info[idx].suggestions.includes(entry.value) 
					&& !newEntries.includes(entry.value)
				) {
					newEntries.push(entry.value);
				}
			})
			//console.log(`Adding new suggestions for field ${idx}:`, newEntries);
			//console.log('Will look like:', [ ...form.info[idx].suggestions, ...newEntries]);
			const uniqueEntries = [ ...new Set([...form.info[idx].suggestions, ...newEntries]) ];
			reduceComposite({ type: 'drill', path: ['form', 'info', idx, 'suggestions'], value: uniqueEntries });
		})
	};

	// Allows saving w & w/o event
	const handleUpsert = (saveEvent) => {	
		if (saveEvent) {
			const valid = validateEvent(dropKeys(event));
			reduceComposite({ type: 'update', errors: { ...errors, event: valid.validity } });
			console.log(valid);
			if (!valid.isValid) { return }
			updateSuggestions();
		} else {
			reduceComposite({ type: 'controlDirty', dirty: { event: false } });
		}
		setPendingSave(true);
	};

	// Trigger save with state so everything is updated before executing the save (particularly suggestions)
	useEffect(() => {
		if (pendingSave) {
			upsertComposite({ ...composite, event: dropKeys(event), form: dropKeys(form)});
			setPendingSave(false);
			setShowForm(false);
		}
	}, [composite, pendingSave]);

	const changeField = (path, val) => {
		reduceComposite({
			type: 'drill',
			path: path,
			value: val
		});
	};

	const addField = (type) => {
		const newField = type === 'mc'
			? { type, label: '', options: [''], baseValue: null }
			: type === 'tf'
				? { type, label: '', baseValue: null }
				: type === 'input'
					? { type, label: '', placeholder: '', baseValue: '', suggestions: [] }
					: { type, label: '', placeholder: '', baseValue: '' };
		reduceComposite({
			type: 'update',
			form: { ...form, info: [...form.info, newField] },
		});
	};

	return (
		<div className="navBlock wButtonRow">

			{/** PATH */}
			<div className="navRow">
				<div id="path" className={errors?.form?.path?.err ? "navCell erred" : "navCell"}>
					<p className="sep">Path</p>
					<DropSelect
						dropHeaderID={"pathInput"}
						options={suggPaths}
						value={{ display: form.path, value: form.path }}
						setter={newPath => {
							changeField(['form', 'path'], newPath);
							changeField(['event', 'path'], newPath);
							for (let ctr = 0; ctr < schedules.length; ctr++) {
								changeField(['schedules', ctr, 'path'], newPath);
							}
						}}
						allowType={true}
						realtimeUpdate={true}
						errorInfo={{ errID: "path", err: errors?.form?.path?.err }}
					/>
					<ErrorInfoButton errID={"path"} err={errors?.form?.path?.err} />
					{allForms.some(f => f.path === form.path) ?
						<div className="navCell">
							<FiUpload 
								className="relButton" 
								tabIndex={-1}
								onClick={() => {
									const matchedSchedules = allSchedules.filter(s => s.path === form.path);
									const matchedForm = allForms.find(f => f.path === form.path)
									reduceComposite({ type: 'set', form: matchedForm, schedules: matchedSchedules });
									updateEventUI(matchedForm.info);
								}}
								onKeyDown={e => {
									if (e.key === 'Enter') {
										e.preventDefault();   // prevent page scroll on Space
										const matchedSchedules = allSchedules.filter(s => s.path === form.path);
										const matchedForm = allForms.find(f => f.path === form.path)
										reduceComposite({ type: 'set', form: matchedForm, schedules: matchedSchedules });
										updateEventUI(matchedForm.info);
									}
								}}
							/>
						</div>
						: 
						<div className="navCell">	
							<FiUpload className="relButton selected" tabIndex={-1}/>	
						</div>
					}
				</div>
			</div>

			{/** SCHEDULE */}
			{
				schedule ?
				  <ScheduleForm
						editSchedule={editSchedule}
						setEditSchedule={setEditSchedule}
						schedule={editSchedule !== null ? schedules[editSchedule] : null}
						schedules={schedules}
						errors={errors.schedules}
						reduceComposite={reduceComposite}
						syncStartAndEnd={syncStartAndEnd}
						setSyncStartAndEnd={setSyncStartAndEnd}
						/>
				: (schedules.length > 0) &&
					<SchedulePreview 
						schedules={schedules}
						reduceComposite={reduceComposite}
						setEditSchedule={setEditSchedule}
						/>
			}

			{/** ADD FORM ELEMENT ROW */}
			{edit && 
				<div className="navRow">
					<button className="relButton" onClick={() => addField('text')}>Text Box</button>
					<button className="relButton" onClick={() => addField('input')}>Input</button>
					<button className="relButton" onClick={() => addField('tf')}>T/F</button>
					<button className="relButton" onClick={() => addField('mc')}>Mult. Choice</button>
					<button
						className={`relButton ${form.includeStart ? 'selected' : ''}`}
						onClick={() =>
							reduceComposite({
								type: 'update',
								form: { ...form, includeStart: !form.includeStart },
							})
						}>
						Start
					</button>
					<FiCheckSquare className="relButton" onClick={() => handleCommitForm()} />
				</div>
			}

			{ /** EDIT FORM ELEMENTS */
				edit ?
					<FormForm 
						form={form}
						errors={errors.form}
						changeField={changeField}
						reduceComposite={reduceComposite}
						syncStartAndEnd={syncStartAndEnd}
						setSyncStartAndEnd={setSyncStartAndEnd}
						/>
				: /** EDIT EVENT INFO */
					<EventForm
						event={event}
						form={form}
						errors={errors.event}
						changeField={changeField}
						reduceComposite={reduceComposite}
						syncStartAndEnd={syncStartAndEnd}
						setSyncStartAndEnd={setSyncStartAndEnd}
						/>
			}

			{ /** COMPLETION INDICATOR */}
			<div className="navRow">
				<p className="sep">Status</p>
				<div className="navCell">
					<button 
						className={`relButton ${event.complete === 'pending' && 'selected'}`}
						onClick={() => event.complete !== 'pending' && reduceComposite({ type: 'drill', path: ['event', 'complete'], value: 'pending' })}
						>
						Pending
					</button>
				</div>
				<div className="navCell">
					<button
						className={`relButton ${event.complete === 'done' && 'selected'}`}
						onClick={() => event.complete !== 'done' && reduceComposite({ type: 'drill', path: ['event', 'complete'], value: 'done' })}
						>
						Done
					</button>
				</div>
				<div className="navCell">
					<button
						className={`relButton ${event.complete === 'skipped' && 'selected'}`}
						onClick={() => event.complete !== 'skipped' && reduceComposite({ type: 'drill', path: ['event', 'complete'], value: 'skipped' })}
						>
						Skipped
					</button>
				</div>
			</div>

			{/** START AND END DATETIMES */}
			{form?.includeStart &&
				// text, type, objKey, schedIdx, fieldKey, date, reduceComposite
				<InteractiveTime
					text={'Start'}
					type={'full'}
					objKey={'event'}
					fieldKey={'startStamp'}
					date={new Date(event.startStamp)}
					reduceComposite={reduceComposite}
					errorInfo={{ errID: "startStamp", err: errors?.event?.startStamp?.err }}
					syncStartAndEnd={syncStartAndEnd}
					setSyncStartAndEnd={setSyncStartAndEnd}
				/>
			}
			<InteractiveTime
				text={'End'}
				type={'full'}
				objKey={'event'}
				fieldKey={'endStamp'}
				date={new Date(event.endStamp)}
				reduceComposite={reduceComposite}
				errorInfo={{ errID: "endStamp", err: errors?.event?.endStamp?.err }}
				syncStartAndEnd={syncStartAndEnd}
				setSyncStartAndEnd={setSyncStartAndEnd}
			/>

			{/** ACTIONS */}
			<div className="submitRow right">
				<FiCalendar
					className={editSchedule === null ? "submitButton" : "submitButton selected"}
					onClick={() => handleCreateSchedule() }/>
				<FiFileText className={edit ? "submitButton selected" : "submitButton"} onClick={() => {
					if (!edit) { 
						setEdit(true); 
					} else { 
						handleRevertForm(); 
					}
					}}/>
				{/** Blur so value is committed on save */}
				<FiCheckCircle className="submitButton" 
					onMouseDown={() => document.activeElement.blur()} 
					onClick={() => {
						handleUpsert(false);
					}}
					/>
				<FiSave className="submitButton" 
					onMouseDown={() => document.activeElement.blur()} 
					onClick={() => {
						handleUpsert(true);
					}}
					/>
				<FiX className="submitButton add" 
					onClick={() => {
						reduceComposite({ type: 'reset' });
						setShowForm(false);
					}}
					/>
			</div>

		</div>
	);
}
