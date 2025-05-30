import { useEffect } from 'react';
import { useRoute } from '../contexts/RouteContext';
import { useFetchWithAuth } from './General';

export const useConnCheck = () => {
	const { backendURL } = useRoute();
	useEffect(() => {
		fetch(`${backendURL}/test/conn`)
			.then(res => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				return res.json()
			})
			.then(info => console.log('Server says:', info.message))
			.catch(err => console.error('Connection failed:', err))
	}, [backendURL])
};

export const useAuthCheck = (user) => {
	const fetchWithAuth = useFetchWithAuth()

	useEffect(() => {
		if (!user) { return } // wait until we’re logged in

		fetchWithAuth('test/auth', '')
			.then(res => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				return res.json()
			})
			.then(info => console.log(info.message))
			.catch(err => console.error('Server Check failed:', err))
	}, [user, fetchWithAuth])
};