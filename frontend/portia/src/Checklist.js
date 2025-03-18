import React, { useState, useEffect } from 'react';

export const Checklist = () => {
	const [checklistItems, setChecklistItems] = useState([]);
	const [newItem, setNewItem] = useState('');
	const [editID, setEditID] = useState(null);
	const [editItem, setEditItem] = useState('');
	const backendURL = 'https://portia-backend.fly.dev/checklist'//'http://localhost:5000/checklist' OR 'https://portia-backend.fly.dev/checklist'

	// Fetch checklist items from the Firestore w/ Flask
	useEffect(() => {
		fetch(
			`${backendURL}`
		).then((response) => 
			response.json()
		).then((data) => {
			setChecklistItems(data);
		}).catch((error) => {
			console.error('Error fetching checklist items:', error);
		});
	}, []);

	// Handle added item
	const addItem = () => {
		if (newItem.trim()) {
			fetch(`${backendURL}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ name: newItem }),
			}).then((response) => 
				response.json()
			).then((data) => {
				setChecklistItems([...checklistItems, data]);
				setNewItem('');
			}).catch((error) => {
				console.error('Error adding checklist item:', error);
			});
		}
	};

	// Handle updating the item name
	const updateItemName = (id, newName) => {
		if (newName.trim()) {
			fetch(`${backendURL}/${id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ name: newName }),
			}).then((response) => 
				response.json()
			).then((updatedItem) => {
				const updatedItems = checklistItems.map((item) =>
					item.id === updatedItem.id ? updatedItem : item
				);
				setChecklistItems(updatedItems);
				setEditID(null);
				setEditItem('');
			}).catch((error) => {
				console.error('Error updating checklist item:', error);
			});
		}
	};

	// Handle completion checkboxes
	const toggleCompleted = (id, completed) => {
		fetch(`${backendURL}/${id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ completed: !completed }),
		}).then((response) => 
			response.json()
		).then(() => {
			const updatedItems = checklistItems.map((item) =>
				item.id === id ? { ...item, completed: !completed } : item
			);
			setChecklistItems(updatedItems);
		}).catch((error) => {
			console.error('Error updating checklist item:', error);
		});
	};

	return (
		<div>
			<h2>Checklist</h2>
			<input
				type="text"
				value={newItem}
				onChange={(e) => setNewItem(e.target.value)}
				placeholder="New item"
			/>
			<button onClick={addItem}>Add Item</button>
			<ul>
				{checklistItems?.map((item) => (
					<li key={item.id}>
						{ item.id == editID ? 
							<>
								<input
									type="text"
									value={editItem}
									onChange={(e) => setEditItem(e.target.value)}
								/>
								<button onClick={() => updateItemName(editID, editItem)}>Confirm</button>
							</> : <>
								{item.name}
								<input
									type="checkbox"
									checked={item.completed}
									onChange={() => toggleCompleted(item.id, item.completed)}
								/>
								<button onClick={() => {setEditID(item.id); setEditItem(item.name);}}>Edit</button>
							</>
						}
					</li>
				))}
			</ul>
		</div>
	);
};
