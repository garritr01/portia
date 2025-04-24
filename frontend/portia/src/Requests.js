import { useUser } from "./Contexts";
import { useCallback } from "react";

const devMode = true;

const BACKEND_URL = devMode ? "http://localhost:5000" : "unknownURL";

/** 
 * - Hook attaches user's credentials.
 * - Static function until creds change.
 */
export const useFetchWithAuth = () => {
	const { user } = useUser();

	// Memoizatoin hook - inhibitor to useEffect's catalyst
	return useCallback(
		async (path, query, options) => {

			if (!user) throw new Error("Not authenticated"); // frontend auth check
			const token = await user.getIdToken();

			const url = `${BACKEND_URL}${path}${query}`;
			return fetch(url, {
				...options,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`, // token for backend auth
					...(options.headers || {}),
				},
			});
		},
		[user]
	);
};

/** 
  - Wrapper for useFetchWithAuth for POST/PUT. Generally 
	- PUT checklist 
	- POST event
*/
export const useSave = () => {
	const fetchWithAuth = useFetchWithAuth();

	return async (route, method, payload) => {
		const res = await fetchWithAuth(route, {
			method,
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			const { error: msg } = await res.json().catch(() => ({}));
			throw new Error(msg || `Server returned ${res.status}`);
		}

		return res.json();
	};
}



/** Check if server alive */

