import React, { createContext, useContext } from "react";

const RouteContext = createContext();

export const RouteProvider = ({ children }) => {
	const backendURL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

	return (
		<RouteContext.Provider value={{ backendURL }}>
			{children}
		</RouteContext.Provider>
	);
};

export const useRoute = () => useContext(RouteContext);
