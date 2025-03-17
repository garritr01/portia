import React, { useContext } from 'react';
import { Login, UserContext } from './user/Auth';
import { Homepage } from './Home';

function App() {
	const { user } = useContext(UserContext);

	return (
		<div className="App">
			{
				user
					? <Homepage />
					: <Login />
			}
		</div>
	);
}

export default App;


