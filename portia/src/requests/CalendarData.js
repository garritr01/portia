// requests/Calendar.js

import { useCallback } from 'react';
import { useFetchWithAuth } from './General';
import { timeStampsToDate } from '../helpers/DateTimeCalcs';

export const useFetchEvents = (startDate, endDate) => {
	const fetchWithAuth = useFetchWithAuth();

	return useCallback(async () => {
		const query = `?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
		const res = await fetchWithAuth('events', query, {});
		if (!res.ok) throw new Error(`Status ${res.status}`);
		const data = await res.json();
		data.sort((a, b) => new Date(a.startStamp) - new Date(b.startStamp));
		return data.map(e => timeStampsToDate(e));
	}, [fetchWithAuth, startDate, endDate]);
};

export const useFetchForms = () => {
	const fetchWithAuth = useFetchWithAuth()
	return useCallback(async () => {
		const res = await fetchWithAuth('forms', '', {})
		if (!res.ok) throw new Error(`Status ${res.status}`)
		return res.json()
	}, [fetchWithAuth])
}

export const useFetchSchedules = () => {
	const fetchWithAuth = useFetchWithAuth()
	return useCallback(async () => {
		const res = await fetchWithAuth('schedules', '', {})
		if (!res.ok) throw new Error(`Status ${res.status}`)
		const data = await res.json()
		return data.map(s => timeStampsToDate(s));
	}, [fetchWithAuth]);
}
