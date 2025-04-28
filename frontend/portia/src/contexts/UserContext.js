import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
	const [user, setUser] = useState(null);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			if (currentUser) {
				setUser(currentUser);
			} else {
				setUser(null);
			}
		});

		return () => unsubscribe();
	}, []);

	return (
		<UserContext.Provider value={{ user }}>
			{children}
		</UserContext.Provider>
	);
};

export const Login = () => {
	const [error, setError] = useState(null);

	const signInWithGoogle = async () => {
		const provider = new GoogleAuthProvider();

		try {
			const result = await signInWithPopup(auth, provider);
			const user = result.user;
			console.log('Signed in with Google:', user.email);
		} catch (error) {
			console.error('Error during Google sign-in:', error.message);
			setError(error.message);
		}
	};

	return (
		<div>
			<h2>Login</h2>
			{error && <p style={{ color: 'red' }}>{error}</p>}
			<button onClick={signInWithGoogle}>Sign in with Google</button>
		</div>
	);
};

export const Logout = async () => {
	try {
		await signOut(auth);
		console.log('User logged out successfully');
	} catch (error) {
		console.error('Error logging out:', error.message);
	}
};

export const useUser = () => useContext(UserContext);
