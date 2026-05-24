import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth,
  initializeAuth,
} from 'firebase/auth';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyBxVKKTyzGAcqtaA0TZxODqjyTVfP-Ghzw",
  authDomain: "storynest-12345.firebaseapp.com",
  projectId: "storynest-12345",
  storageBucket: "storynest-12345.firebasestorage.app",
  messagingSenderId: "564839035602",
  appId: "1:564839035602:web:bc241f38f6c57b0692330b"
};

// 1. Singleton App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. Singleton Auth
// Using a function-wrapped singleton to ensure it's not called too early
let _auth: any = null;

export const getAuthSafe = () => {
  if (_auth) return _auth;

  if (Platform.OS === 'web') {
    _auth = getAuth(app);
    return _auth;
  }

  try {
    _auth = initializeAuth(app);
  } catch (e) {
    _auth = getAuth(app);
  }
  return _auth;
};

// Export the instance for use in AuthContext
export const auth = getAuthSafe();
