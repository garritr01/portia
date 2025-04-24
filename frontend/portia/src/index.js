/* index.js */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import reportWebVitals from './reportWebVitals';
import { UserProvider, ScreenProvider } from './Contexts';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
	<React.StrictMode>
		<UserProvider>
			<ScreenProvider>
				<App />
			</ScreenProvider>
		</UserProvider>
	</React.StrictMode>
);

reportWebVitals();

