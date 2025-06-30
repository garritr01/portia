// views/LeftMenu.js

import React, { useState, useEffect } from 'react';
import { useChecklistDataHandler } from '../helpers/DataHandlers';
import { ChecklistForm } from '../components/ChecklistForm';

export const LeftMenu = ({ Logout, leftExpanded }) => {
	const { checklist, upsertChecklist } = useChecklistDataHandler(); 
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

	/** Delete doc with _id 
	const deleteChecklistItem = async (_id) => {
		try {
			await save(`checklist/${_id}`, 'DELETE', {});
			setChecklist(prev =>
				prev.filter(item => item._id !== _id)
			);
		} catch (err) {
			console.error(`Error deleting checklist item ${_id}: ${err}`);
		}
	};*/
	
	return (
		<div className={`leftMenu ${leftExpanded ? 'expand' : ''}`}>
			<button className="logoutButton" onClick={() => Logout()}>Logout</button>
			<h1>Por.tia</h1>
			<div className="checklist">
				<h2>Checklist</h2>

				{/** Create new checklist item form */}
				{showForm === "new" && 
					<ChecklistForm 
						form={form} 
						setForm={setForm} 
						setShowForm={setShowForm}
						upsertChecklist={upsertChecklist}
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
								<button className="relButton" onClick={() => upsertChecklist({ ...item, active: false })}>✓</button>
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

									{/** Delete checklist item 
									<button className="submitButton" onClick={() => deleteChecklistItem(item._id)}>
										Delete
									</button>
									*/}

								</div>

								<div className="formRow">{item.title}</div>
								<div className="formRow">{item.note}</div>

							</div>
						}

						{/** Update checklist item form */}
						{showForm === item._id &&
							<ChecklistForm
								form={form}
								setForm={setForm}
								setShowForm={setShowForm}
								upsertChecklist={upsertChecklist}
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

