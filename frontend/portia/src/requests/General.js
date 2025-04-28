import { useUser } from "../contexts/UserContext";
import { useRoute } from "../contexts/RouteContext";
import { useCallback } from "react";

/** 
 * - Hook attaches user's credentials.
 * - Static function until creds change.
 */
export const useFetchWithAuth = () => {
	const { user } = useUser();
	const { backendURL } = useRoute();

	// Memoizatoin hook - inhibitor to useEffect's catalyst
	return useCallback(
		async (path, query = "", options = {}) => {

			if (!user) throw new Error("Not authenticated"); // frontend auth check
			const token = await user.getIdToken();

			const url = `${backendURL}/${path}${query}`;
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
		const res = await fetchWithAuth(route, "", {
			method,
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			const { error: msg } = await res.json().catch(() => ({}));
			throw new Error(msg || `Server returned ${res.status}`);
		}

		return res.json();
	};
};
