import React, { useContext, useState } from 'react';
import { UserContext, Logout } from './user/Auth';
import { Checklist } from './Checklist';
import { Calendar } from './Calendar';

export const Homepage = () => {
	const { user } = useContext(UserContext);
	const [clicked, setClicked] = useState(false);

	return (
		<div>
			<div className={clicked ? "leftMenu active" : "leftMenu"} onClick={() => setClicked(true)}>
				<h1>POR.tIA</h1>
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
			<div className="topMenu" onClick={() => setClicked(false)}>
				<div className = "leftButtons">
					<button>Record</button>
					<button>Schedule</button>
					<button>Analyze</button>
					<button>Journal</button>
				</div>
				<div className="rightButtons">
					<button>Settings</button>
					<button>Logout</button>
				</div>
			</div>
			<Calendar />
		</div>
	);
};
