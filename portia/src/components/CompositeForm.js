// components/CompositeForm.js

import React, { useState, useEffect, useRef } from 'react';
import {
	FiX,
	FiCalendar,
	FiFileText,
	FiRotateCcw,
	FiCheckSquare,
	FiSave,
	FiCheckCircle,
	FiCheck,
	FiEdit
} from 'react-icons/fi';
import { validateForm, validateEvent, validateSchedule } from '../helpers/InputValidation';
import {
	clamp,
	returnDates,
	addTime,
	timeDiff,
	normDate,
	editFriendlyDateTime,
	calcFriendlyDateTime,
	viewFriendlyDateTime,
	periodOptions,
	weekdayOptions,
	monthOptions,
	monthLength,
	getDayOfWeek,
} from '../helpers/DateTimeCalcs';
import { makeEmptySchedule } from '../helpers/HandleComposite';
import { useDataHandler } from '../helpers/DataHandlers';
import { ErrorInfoButton, invalidInputFlash } from './Notifications';
import { DropSelect, InfDropSelect } from './Dropdown';

export const InteractiveTime = ({ text, type, objKey, schedIdx = null, fieldKey, date, errorInfo, reduceComposite }) => {
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
			const upDate = calcFriendlyDateTime(unit, date, { ...rawParts, [unit]: newVal });
			if (schedIdx === null && objKey === 'event') {
				// 'event' case
				reduceComposite({ type: 'drill', path: [objKey, fieldKey], value: upDate });
			} else if (objKey === 'schedules') {
				// 'schedules' case
				reduceComposite({ type: 'drill', path: [objKey, schedIdx, fieldKey], value: upDate });
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
		<div id={fieldKey} className={errorInfo?.err ? "formRow erred" : "formRow"}>
			<p className="sep">{text}</p>
			{format.order.map((unit) => (
				<React.Fragment key={`${fieldKey}_${unit}`}>
					<div className="formCell">
						{unit === 'year' ?
							<InfDropSelect
								value={{ display: String(date.getFullYear()), value: date.getFullYear() }}
								setter={(newVal) => commitPart(unit, newVal)}
								allowType={true}
							/>
							:
							<DropSelect
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
			<ErrorInfoButton {...errorInfo} />
		</div>
	)
}

const ScheduleForm = ({ editSchedule, setEditSchedule, schedule, schedules, errors, ogState, reduceComposite }) => {

	// Reset to last committed state
	const handleRevertSchedule = () => {
		// Revert if ogState is not empty, otherwise delete
		const old = ogState.current.schedule;
		if (old && Object.keys(old).length > 0) {
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
		ogState.current.schedule = newSchedule;
		setEditSchedule(null);
	};

	return (
		<div className="form wButtonRow">
			<strong>Schedule</strong>

			{/** PERIOD */}
			<div className="formRow">
				<p className="sep">Period</p>
				<div id="period" className="formCell">
					<DropSelect
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
			<div className="formRow">
				{schedule.period && schedule.period !== 'single' &&
					<>
						<p className="sep">Every</p>
						<div id="interval" className={errors?.interval?.err ? "formCell errCell" : "formCell"}>
							<InfDropSelect
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
				<div className="form">
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
					/>
				</div>
			}

			{/** EFFECTIVE RANGE */}
			{schedule.period && schedule.period !== 'single' &&
				<div className="form">
					<strong>Until</strong>
					<InteractiveTime
						text={'End'}
						objKey={'schedules'}
						schedIdx={editSchedule}
						fieldKey={'until'}
						date={new Date(schedule.until)}
						reduceComposite={reduceComposite}
						errorInfo={{ errID: "until", err: errors?.until?.err }}
					/>
				</div>
			}

			{/** REVERT OR COMMIT */}
			<div className="submitRow right">
				<FiRotateCcw className="submitButton" onClick={() => handleRevertSchedule()} />
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
									<p className="formCell">{rule.interval} {periodOptions.find((opt) => opt.value === rule.period)?.altDisplay || 'No Alt Display?'}s</p>
									: <p className="formCell">{periodOptions.find((opt) => opt.value === rule.period)?.altDisplay || 'No Alt Display?'}</p>
								}
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
	};

	return (
		form.info.map((f, idx) => (
			<React.Fragment key={idx}>
				<div className="formRow">
					<div id={`${idx}-label`} className={errors?.info?.[idx]?.label?.err ? "formCell erred" : "formCell"}>
						<input
							placeholder="Label..."
							value={f.label}
							onChange={e => changeField(['form', 'info', idx, 'label'], e.target.value)}
						/>
						<ErrorInfoButton errID={`${idx}-label`} err={errors?.info?.[idx]?.label?.err} />
					</div>
					{f.type === 'input' ?
						<div id={`${idx}-placeholder`} className={errors?.info?.[idx]?.placeholder?.err ? "formCell erred" : "formCell"}>
							<input
								placeholder="Placeholder..."
								value={f.placeholder}
								onChange={e => changeField(['form', 'info', idx, 'placeholder'], e.target.value)}
							/>
							<ErrorInfoButton errID={`${idx}-placeholder`} err={errors?.info?.[idx]?.placeholder?.err} />
						</div>
						: f.type === 'tf' ?
							<>
								<button className="relButton">True</button>
								<button className="relButton">False</button>
							</>
							: null
					}
					<button className="relButton" onClick={() => deleteField(idx)}>×</button>
					{/* <button className="relButton" onPointerDown={() => startFieldDrag(idx)}>⇅</button> */}
				</div>
				{f.type === 'text' ?
					<div className="formRow">
						<div id={`${idx}-placeholder`} className={errors?.info?.[idx]?.placeholder?.err ? "formCell erred" : "formCell"}>
							<textarea
								placeholder="Placeholder..."
								value={f.placeholder}
								onChange={e => changeField(['form', 'info', idx, 'placeholder'], e.target.value)}
							/>
							<ErrorInfoButton errID={`${idx}-placeholder`} err={errors?.info?.[idx]?.placeholder?.err} />
						</div>
					</div>
					: f.type === 'mc' ?
						<div className="formRow">
							{f.options.map((opt, optIdx) => (
								<React.Fragment key={optIdx}>
									<div id={`${idx}-options-${optIdx}`} className={errors?.info?.[idx]?.options?.[optIdx]?.err ? "formCell erred" : "formCell"}>
										<input
											placeholder={`Option ${optIdx + 1}...`}
											value={opt}
											onChange={e => changeField(['form', 'info', idx, 'options', optIdx], e.target.value)}
										/>
										<ErrorInfoButton errID={`${idx}-options-${optIdx}`} err={errors?.info?.[idx]?.options?.[optIdx]?.err} />
									</div>
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

const EventForm = ({ event, errors, changeField, reduceComposite }) => {

	const addInput = (idx) => {
		if (event.info[idx].type !== 'input') {
			console.warn("Cannot add input from non-input field");
			return;
		} else {
			console.log("Adding to ", event.info[idx])
		}

		const contentCopy = [...event.info[idx].content];
		reduceComposite({
			type: 'drill',
			path: ['event', 'info', idx, 'content'],
			value: [...contentCopy, null]
		});
	};

	const removeInput = (fieldIdx, inpIdx) => {
		if (event.info[fieldIdx].type !== 'input') {
			console.warn("Cannot remove input from non-input field");
			return;
		}

		const contentCopy = [...event.info[fieldIdx].content];
		const updatedContent = contentCopy.filter((_, i) => i !== inpIdx);
		reduceComposite({
			type: 'drill',
			path: ['event', 'info', fieldIdx, 'content'],
			value: updatedContent
		});
	};

	return (
		event.info.map((f, idx) => (
			<React.Fragment key={idx}>
				<div className="formRow" key={idx}>
					<p className="sep">{f.label}</p>
					{f.type === 'input' ?
						<>
							{f.content.map((inp, inpIdx) => (
								<div key={inpIdx} id={`${idx}-content-${inpIdx}`} className={errors?.event?.info?.[idx]?.content?.[inpIdx]?.err ? "formCell erred" : "formCell"}>
									<input key={inpIdx}
										placeholder={f.placeholder + '...'}
										value={inp}
										onChange={e => changeField(['event', 'info', idx, 'content', inpIdx], e.target.value)}
									/>
									<button className="relButton" onClick={() => removeInput(idx, inpIdx)}>×</button>
									<ErrorInfoButton errID={`${idx}-content-${inpIdx}`} err={errors?.event?.info?.[idx]?.content?.[inpIdx]?.err} />
								</div>
							))}
							<button className="relButton" onClick={() => addInput(idx)}>+</button>
						</>
						: f.type === 'tf' ?
							<div id={`${idx}-content`} className={errors?.event?.info?.[idx]?.content?.err ? "formCell erred" : "formCell"}>
								<button className={`relButton ${f.content === true ? 'selected' : ''}`}
									onClick={() => changeField(['event', 'info', idx, 'content'], f.content === true ? null : true)}>
									True
								</button>
								<button className={`relButton ${f.content === false ? 'selected' : ''}`}
									onClick={() => changeField(['event', 'info', idx, 'content'], f.content === false ? null : false)}>
									False
								</button>
								<ErrorInfoButton errID={`${idx}-content`} err={errors?.event?.info?.[idx]?.content?.err} />
							</div>
							: null
					}
				</div>
				{f.type === 'text' ?
					<div className="formRow">
						<div id={`${idx}-content`} className={errors?.event?.info?.[idx]?.content[0]?.err ? "formCell erred" : "formCell"}>
							<textarea
								placeholder={f.placeholder + '...'}
								value={f.content}
								onChange={e => changeField(['event', 'info', idx, 'content'], e.target.value)}
							/>
							<ErrorInfoButton errID={`${idx}-content`} err={errors?.event?.info?.[idx]?.content[0]?.err} />
						</div>
					</div>
					: f.type === 'mc' ?
						<div className="formRow">
							{f.options.map((opt, optIdx) => (
								<div key={optIdx} id={`${idx}-content-${optIdx}`} className={errors?.event?.info?.[idx]?.options?.[optIdx]?.err ? "formCell erred" : "formCell"}>
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

export const CompositeForm = ({ composite, reduceComposite, upsertComposite, setShowForm }) => {

	const { form, event, schedules, dirty, errors } = composite;
	const [editSchedule, setEditSchedule] = useState(null);
	const schedule = editSchedule !== null ? schedules[editSchedule] : null;
	const [edit, setEdit] = useState(false);

	// Holds last state for easy reversion
	const ogState = useRef({
		form: { ...form, info: [...form.info] },
		schedule: editSchedule !== null ? { ...schedules[editSchedule] } : {},
	});

	//useEffect(() => console.log("form:\n", form), [form]);
	//useEffect(() => console.log("event:\n", event), [event]);
	//useEffect(() => console.log("schedules:\n", schedules), [schedules]);
	//useEffect(() => console.log("dirty:\n", dirty), [dirty]);
	//useEffect(() => console.log("errors:\n", errors), [errors]);

	const handleRevertForm = () => {
		reduceComposite({ type: 'update', form: ogState.current.form });
		setEdit(false);
	};

	const handleCommitForm = () => {
		const valid = validateForm(form);
		reduceComposite({ type: 'update', errors: { ...errors, form: valid.validity } });
		if (!valid.isValid) {
			return;
		}
		ogState.current.form = {
			...form,
			info: [...form.info]
		};
		setEdit(false);
		updateEventUI(form.info);
	};

	// Update event info for filling out based on form info without removing event content already present
	const updateEventUI = (updatedFormInfo) => {
		const updatedEventInfo = updatedFormInfo.map((f, idx) => {
			const prevEvent = event.info.find(e => (e.label === f.label && 'content' in e));
			if (prevEvent) {
				return { ...f, content: prevEvent.content };
			} else {
				const emptyContent = (f.type === 'input' || f.type === 'text') ? [''] : null;
				return { ...f, content: emptyContent }
			}
		});
		reduceComposite({
			type: 'update',
			event: {
				...event,
				info: updatedEventInfo,
			}
		})
	};

	// Allows saving w & w/o event
	const handleUpsert = (saveEvent) => {
		const outDirty = { ...dirty, event: (saveEvent && dirty.event) };
		if (saveEvent) {
			const valid = validateEvent(event);
			reduceComposite({ type: 'update', errors: { ...errors, event: valid.validity } });
			if (!valid.isValid) { return }
		}
		upsertComposite(composite, outDirty);
	};

	const changeField = (path, val) => {
		reduceComposite({
			type: 'drill',
			path: path,
			value: val
		});
	};

	const addField = (type) => {
		const newField = type === 'mc'
			? { type, label: '', options: [''] }
			: type === 'tf'
				? { type, label: '' }
				: type === 'input'
					? { type, label: '', placeholder: '', suggestions: [] }
					: { type, label: '', placeholder: '' };
		reduceComposite({
			type: 'update',
			form: { ...form, info: [...form.info, newField] },
		});
	};

	return (
		<div className="form wButtonRow">

			{/** PATH */}
			<div className="formRow">
				<div id="path" className={errors?.event?.path?.err ? "formCell erred" : "formCell"}>
					<p className="sep">Path</p>
					<input
						placeholder="work/projects/..."
						value={form.path || ''}
						onChange={e => {
							changeField(['form', 'path'], e.target.value);
							changeField(['event', 'path'], e.target.value);
							for (let ctr = 0; ctr < schedules.length; ctr++) {
								changeField(['schedules', ctr, 'path'], e.target.value);
							}
						}}
					/>
					<ErrorInfoButton errID={"path"} err={errors?.event?.path?.err} />
					<FiCheck className="relButton"/>
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
						ogState={ogState}
						errors={errors.schedule}
						reduceComposite={reduceComposite}
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
				<div className="formRow">
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
					<FiRotateCcw className="relButton" onClick={() => handleRevertForm()} />
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
						/>
				: /** EDIT EVENT INFO */
					<EventForm
						event={event}
						errors={errors.event}
						changeField={changeField}
						reduceComposite={reduceComposite}
						/>
			}

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
			/>

			{/** ACTIONS */}
			<div className="submitRow right">
				<FiCalendar
					className={editSchedule === null ? "submitButton" : "submitButton selected"}
					onClick={() => {
						setEditSchedule(schedules.length);
						reduceComposite({ type: 'drill', path: ['schedules', schedules.length], value: makeEmptySchedule(event.path) });
					}}
					/>
				<FiFileText className={edit ? "submitButton selected" : "submitButton"} onClick={() => setEdit(true)}/>
				<FiCheckCircle className="submitButton" onClick={() => handleUpsert(false)}/>
				<FiSave className="submitButton" onClick={() => handleUpsert(true)}/>
				<FiX className="submitButton add" onClick={() => setShowForm({ _id: null })}/>
			</div>

		</div>
	);
}