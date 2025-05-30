import React, { createContext, useContext, useState, useEffect } from 'react';

export const ScreenContext = createContext();

export const ScreenProvider = ({ children, thresh = 600 }) => {
	const [smallScreen, setSmallScreen] = useState(window.innerWidth <= thresh);

	useEffect(() => {
		const handleResize = () => {
			const nowSmall = window.innerWidth <= thresh;
			setSmallScreen(prev => (prev !== nowSmall ? nowSmall : prev));
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [thresh]);

	return (
		<ScreenContext.Provider value={{ smallScreen }}>
			{children}
		</ScreenContext.Provider>
	);
};

export const useScreen = () => useContext(ScreenContext);