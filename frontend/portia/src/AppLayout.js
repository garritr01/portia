import React, { useState } from 'react';
import { useScreen, Logout } from './Contexts';
import { useSwipe } from './dynamicView';
import './index.css';

export const AppLayout = ({ menuItems = [], children, leftExpanded, setLeftExpanded }) => {
	const { smallScreen = false } = useScreen() || {};

	return (
		<div className="container">
			<div className={`leftMenu ${leftExpanded ? 'expand' : ''}`}>
				<button className="logoutButton" onClick={() => Logout()}>Logout</button>
				<ul>
					{menuItems.map(item => (
						<li key={item.id}>{item.label}</li>
					))}
				</ul>
			</div>
			{!smallScreen && <button className="resizer" onClick={() => setLeftExpanded(!leftExpanded)}>||</button>}
			<div className="calendar">
				{smallScreen && !leftExpanded && <button className="hamburger" onClick={() => setLeftExpanded(true)}>☰</button>}
				{children}
			</div>
		</div>
	);
};
