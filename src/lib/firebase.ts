import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (error.code === 'auth/cancelled-popup-request') {
      console.warn('Sign-in popup already open or request cancelled.');
      return;
    }
    if (error.code === 'auth/popup-closed-by-user') {
      console.warn('Sign-in popup closed by user.');
      return;
    }
    console.error('Auth error:', error);
    throw error;
  }
};
export const logout = () => signOut(auth);
