import { useCallback } from 'react';
import { useFetchWithAuth } from './General';
import { rRuleStrToRRule, getOccurances } from '../helpers/DateTimeCalcs';

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

export const useFetchRRules = () => {
	const fetchWithAuth = useFetchWithAuth()
	return useCallback(async () => {
		const res = await fetchWithAuth('rrules', '', {})
		if (!res.ok) throw new Error(`Status ${res.status}`)
		const data = await res.json()
		return data.map(r => ({
			...r,
			startStamp: new Date(r.startStamp),
			endStamp: new Date(r.endStamp),
		}))
	}, [fetchWithAuth]);
}

export const getAllRecurs = (rRules, startDate, endDate) => {
	const allRecurs = [];
	rRules.forEach(rRule => {
		const ruleStart = new Date(rRule.startStamp);
		const ruleEnd = new Date(rRule.endStamp);
		const latestStart = startDate < ruleStart ? ruleStart : startDate;
		const earliestEnd = (ruleEnd && endDate > ruleEnd) ? ruleEnd : endDate;
		const rule = rRuleStrToRRule(rRule.rule);
		const recurs = getOccurances(rule, latestStart, earliestEnd);

		recurs.forEach(recur => {
			allRecurs.push({
				_id: rule._id,
				startStamp: recur,
				endStamp: new Date(recur.getTime() + rRule.duration),
			});
		});
	});
	return allRecurs;
}

