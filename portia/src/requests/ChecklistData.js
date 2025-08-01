// requests/Checklist.js

import { useCallback } from 'react';
import { useFetchWithAuth } from './General';
import { sortChecklist } from '../helpers/DateTimeCalcs';

export const useFetchChecklist = () => {
	const fetchWithAuth = useFetchWithAuth();

	return useCallback(async () => {
		const res = await fetchWithAuth('checklist', '', {});
		if (!res.ok) throw new Error(`GET Checklist status: ${res.status}`);
		const checklist = await res.json();
		return sortChecklist(checklist);
	}, [fetchWithAuth]);
};
