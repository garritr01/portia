export const ChecklistForm = ({ form, setForm, setShowForm, upsertChecklist }) => {

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
				<button className="submitButton" onClick={() => upsertChecklist(form)}>Save</button>
				<button className="submitButton add" onClick={() => setShowForm(null)}>-</button>
			</div>
		</div>
	);
};