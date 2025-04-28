import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import reportWebVitals from './reportWebVitals';
import { UserProvider } from './contexts/UserContext';
import { ScreenProvider } from './contexts/ScreenContext';
import { RouteProvider } from './contexts/RouteContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
	<React.StrictMode>
		<RouteProvider>
			<UserProvider>
				<ScreenProvider>
					<App />
				</ScreenProvider>
			</UserProvider>
		</RouteProvider>
	</React.StrictMode>
);

reportWebVitals();

