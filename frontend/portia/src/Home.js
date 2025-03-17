import React, { useContext } from 'react';
import { UserContext, Logout } from './user/Auth';
import { Checklist } from './Checklist';

export const Homepage = () => {
	const { user } = useContext(UserContext);

	return (
		<div>
			<h1>Homepage</h1>
			{user ? (
				<>
					<p>Welcome, {user.displayName || 'User'}!</p>
					<Checklist />
					<button onClick={Logout}>Logout</button>
				</>
			) : (
				<p>Redirecting... </p>
			)}
		</div>
	);
};
