import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import reportWebVitals from './reportWebVitals';
import { UserProvider } from './contexts/UserContext';
import { RouteProvider } from './contexts/RouteContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
	<React.StrictMode>
		<RouteProvider>
			<UserProvider>
				<App />
			</UserProvider>
		</RouteProvider>
	</React.StrictMode>
);

reportWebVitals();

