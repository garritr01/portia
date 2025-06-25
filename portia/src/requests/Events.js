import { useCallback } from 'react';
import { useFetchWithAuth } from './General';
import { rRuleStrToRRule, objToRRule, getOccurances, addTime, timeDiff } from '../helpers/DateTimeCalcs';

export const useFetchEvents = (startDate, endDate) => {
	const fetchWithAuth = useFetchWithAuth();

	return useCallback(async () => {
		const query = `?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
		const res = await fetchWithAuth('events', query, {});
		if (!res.ok) throw new Error(`Status ${res.status}`);
		const data = await res.json();
		data.sort((a, b) => new Date(a.startStamp) - new Date(b.startStamp));
		return data.map(e => {{
			return {
				...e,
				startStamp: new Date(e.startStamp),
				endStamp: new Date(e.endStamp),
			}
		}});
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
		return data.map(s => ({
			...s,
			startStamp: new Date(s.startStamp),
			endStamp: new Date(s.endStamp),
			startRangeStamp: new Date(s.startRangeStamp),
			endRangeStamp: new Date(s.endRangeStamp),
		}));
	}, [fetchWithAuth]);
}

export const getAllRecurs = (schedules, startDate, endDate) => {
	const allRecurs = [];
	schedules.forEach(sched => {
		const ruleStart = new Date(sched.startStamp);
		const ruleEnd = new Date(sched.endStamp);
		const latestStart = startDate < ruleStart ? ruleStart : startDate;
		const earliestEnd = (ruleEnd && endDate > ruleEnd) ? ruleEnd : endDate;
		const rule = objToRRule(sched);
		const recurs = getOccurances(rule, latestStart, earliestEnd);
		
		recurs.forEach(recur => {
			allRecurs.push({
				_id: sched._id,
				path: sched.path,
				startStamp: recur,
				endStamp: addTime(recur, timeDiff(ruleEnd, ruleStart))
			});
		});
	});
	return allRecurs;
}

