import React, { useState, useEffect } from 'react';
import { TypeCheck } from '../helpers/InputValidation';
import { useSave } from '../requests/General';
import { sortChecklist } from '../helpers/DynamicView';

export const LeftMenu = ({ Logout, checklist, setChecklist, leftExpanded, smallScreen }) => {
	const save = useSave();
	const [ showNotes, setShowNotes ] = useState({});
	const [ showForm, setShowForm ] = useState(null);
	const emptyForm = { title: '', note: '', priority: 0 };
	const [ form, setForm ] = useState(emptyForm);

	// clear all editing states on left shrink
	useEffect(() => {
		if (!leftExpanded) {
			setShowForm(null);
			setShowNotes(prev => {
				const updated = {};
				Object.keys(prev).forEach(id => {
					updated[id] = false;
				});
				return updated;
			});
		}
	}, [leftExpanded]);

	// autofill/empty form based 'showForm' value (_id, 'new', or null)
	useEffect(() => {
		if (showForm === null || showForm === 'new') {
			setForm(emptyForm);
		} else {
			const formItem = checklist.find(item => item._id === showForm);
			setForm(formItem);
		}
	}, [showForm]);

	// update the 'showNotes' array on checklist update
	useEffect(() => {
		setShowNotes(prev => {
			const updated = {};
			checklist.forEach(({ _id }) => {
				if (!(_id in updated)) {
					updated[_id] = prev[_id] ?? false;
				}
			});
			return updated;
		});
	}, [checklist]);

	// Validate checklist item before attempting to store
	const validateNewItem = async (item) => {
		if (item.formID !== null && !TypeCheck(item.formID, ['string'])) {
			console.error('Invalid formID:', item.formID);
			return false;
		}
		if (item.participants !== null && !TypeCheck(item.participants, ['array'])) {
			console.error('Invalid participants:', item.participants);
			return false;
		}
		// Title must have content
		if (!TypeCheck(item.title, ['string']) || !item.title) {
			console.error('Invalid title:', item.title);
			return false;
		}
		if (!TypeCheck(item.note, ['string'])) {
			console.error('Invalid note:', item.note);
			return false;
		}
		if (!TypeCheck(item.active, ['boolean'])) {
			console.error('Invalid active:', item.active);
			return false;
		}
		if (!TypeCheck(item.priority, ['number'])) {
			console.error('Invalid priority:', item.active);
			return false;
		}
		return true;
	}

	// Save or update checklist item
	const updateChecklist = async (directlyPassedForm = null) => {
		try {

			// Use a directly passed in form or the form state (pass directly on clicking check mark)
			const source = directlyPassedForm ?? form;

			// reformat form from UI to storage structure
			const formToSave = {
				formID: source.formID ?? null,
				participants: source.participants ?? [],
				title: source.title.trim(),
				note: source.note.trim(),
				active: source.active ?? true,
				priority: parseInt(source.priority, 10) ?? 0,
				updatedAt: new Date().toISOString(),
			}

			const valid = await validateNewItem(formToSave)
			if (!valid) { return }

			if (source._id) {
				// Update checklist item
				const updated = await save(`checklist/${source._id}`, 'PUT', formToSave);
				// Update changed item or drop if complete
				setChecklist(prev => sortChecklist(
					prev.map(item => (item._id === updated._id ? updated : item))
					.filter(item => item.active)
				));
				setShowForm(null);
				setForm(emptyForm);
				console.log(`Updated ${updated.title}`);
			} else {
				// Create new checklist item
				const saved = await save('checklist/new', 'POST', formToSave);
				setChecklist(prev => sortChecklist([ ...prev, saved ]));
				setShowForm(null);
				setForm(emptyForm);
				console.log(`Created ${saved.title}`);
			}
		} catch (err) {
			console.error(`Error updating checklist: ${err}`);
		}
	}

	/** Delete doc with _id */
	const deleteChecklistItem = async (_id) => {
		try {
			await save(`checklist/${_id}`, 'DELETE', {});
			setChecklist(prev =>
				prev.filter(item => item._id !== _id)
			);
		} catch (err) {
			console.error(`Error deleting checklist item ${_id}: ${err}`);
		}
	};
	
	return (
		<div className={`leftMenu ${leftExpanded ? 'expand' : ''}`}>
			<button className="logoutButton" onClick={() => Logout()}>Logout</button>
			<h1>Por.tia</h1>
			<div className="checklist">
				<h2>Checklist</h2>

				{/** Create new checklist item form */}
				{showForm === "new" && 
					<ItemForm 
						form={form} 
						setForm={setForm} 
						setShowForm={setShowForm}
						updateChecklist={updateChecklist}
						/>
				}

				{/** Map checklist and open menus/update db */}
				{checklist.map(item => (

					<div className='item' key={item._id}>
						<div className="formRow">

							{/** Label click opens or closes notes */}
							<p className="label"
								onClick={() => leftExpanded && (
									item._id !== showForm ? 
										setShowNotes(prev => ({ ...prev, [item._id]: !prev[item._id]}))
										: setShowForm(null)
								)}>
								• {item.title}
							</p>

							{item._id !== showForm && /** Complete task by setting active to false... hide if edit form is open */
								<button className="relButton" onClick={() => updateChecklist({ ...item, active: false })}>✓</button>
							}

						</div>
						
						{/** Show expanded information and options about item IF _id was toggled */}
						{item._id in showNotes && showNotes[item._id] &&
							/** flex column pinned to bottom of item */
							<div className="form">

								{/** flex row pinned to top right corner */}
								<div className="submitRow right">

									{/** Open editing form and hide expanded info */}
									<button className="submitButton" 
										onClick={() => {
											setShowNotes(prev => ({ ...prev, [item._id]: false }))
											setShowForm(item._id);
										}}>
											Edit
									</button>

									{/** Delete checklist item */}
									<button className="submitButton" onClick={() => deleteChecklistItem(item._id)}>
										Delete
									</button>

								</div>

								<div className="formRow">{item.title}</div>
								<div className="formRow">{item.note}</div>

							</div>
						}

						{/** Update checklist item form */}
						{showForm === item._id &&
							<ItemForm
								form={form}
								setForm={setForm}
								setShowForm={setShowForm}
								updateChecklist={updateChecklist}
							/>
						}

					</div>
				))}

				{/** Render 'new' form last to overlay other content w/ no z-index */}
				{leftExpanded && showForm !== 'new' &&
					<button className="submitButton right add" onClick={() => leftExpanded && setShowForm('new')}>+</button>
				}

			</div>
		</div>
	);
};

const ItemForm = ({ form, setForm, setShowForm, updateChecklist }) => {

	const updateForm = (value, prop) => {
		setForm(prev => ({
			...prev, 
			[prop]: value,
		}))
	}

	return (
		<div className='form'>
			<div className="formRow">
				<p className="formCell">Task</p>
				<input
					className="formCell"
					placeholder="Name task here..."
					value={form.title}
					onChange={e => updateForm(e.target.value, 'title')}
				/>
			</div>
			<textarea
				className="formRow"
				placeholder="Detail task here..."
				value={form.note}
				onChange={e => updateForm(e.target.value, 'note')}
			/>
			<input
				className="formRow"
				placeholder="0"
				value={form.priority}
				onChange={e => updateForm(e.target.value, 'priority')}
			/>
			<div className="submitRow right">
				<button className="submitButton" onClick={() => updateChecklist()}>Save</button>
				<button className="submitButton add" onClick={() => setShowForm(null)}>-</button>
			</div>
		</div>
	);
};
