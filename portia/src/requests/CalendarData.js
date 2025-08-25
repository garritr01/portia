// requests/CalendarData.js

import { useCallback } from 'react';
import { useFetchWithAuth } from './General';
import { ISOsToDates } from '../helpers/DateTimeCalcs';

export const useFetchEvents = () => {
	const fetchWithAuth = useFetchWithAuth();

	return useCallback(async (start, end) => {
		const query = `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
		const res = await fetchWithAuth('events', query, {});
		if (!res.ok) throw new Error(`Status ${res.status}`);
		const data = await res.json();
		return data.map(e => ISOsToDates(e));
	}, [fetchWithAuth]);
};

export const useFetchCompletions = () => {
	const fetchWithAuth = useFetchWithAuth();

	return useCallback(async (start, end) => {
		const query = `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
		const res = await fetchWithAuth('completions', query, {});
		if (!res.ok) throw new Error(`Status ${res.status}`);
		const data = await res.json();
		return data.map(e => ISOsToDates(e));
	}, [fetchWithAuth]);
};

export const useFetchForms = () => {
	const fetchWithAuth = useFetchWithAuth()
	return useCallback(async () => {
		const res = await fetchWithAuth('forms', '', {})
		if (!res.ok) throw new Error(`Status ${res.status}`)
		return res.json()
	}, [fetchWithAuth])
};

export const useFetchSchedules = () => {
	const fetchWithAuth = useFetchWithAuth()
	return useCallback(async () => {
		const res = await fetchWithAuth('schedules', '', {});
		if (!res.ok) throw new Error(`Status ${res.status}`);
		const data = await res.json();
		return data.map(s => ISOsToDates(s));
	}, [fetchWithAuth]);
};
