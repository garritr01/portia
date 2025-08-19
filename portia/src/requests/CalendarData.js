// requests/CalendarData.js

import { useCallback } from 'react';
import { useFetchWithAuth } from './General';
import { ISOsToDates } from '../helpers/DateTimeCalcs';

export const useFetchEvents = (startDate, endDate) => {
	const fetchWithAuth = useFetchWithAuth();

	return useCallback(async () => {
		const query = `?start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`;
		const res = await fetchWithAuth('events', query, {});
		if (!res.ok) throw new Error(`Status ${res.status}`);
		const data = await res.json();
		return data.map(e => ISOsToDates(e));
	}, [fetchWithAuth, startDate, endDate]);
};

export const useFetchCompletions = (startDate, endDate) => {
	const fetchWithAuth = useFetchWithAuth();

	return useCallback(async () => {
		const query = `?start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`;
		const res = await fetchWithAuth('completions', query, {});
		if (!res.ok) throw new Error(`Status ${res.status}`);
		const data = await res.json();
		return data.map(e => ISOsToDates(e));
	}, [fetchWithAuth, startDate, endDate]);
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
