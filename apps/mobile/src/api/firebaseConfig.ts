import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth,
  initializeAuth,
  // @ts-ignore
  getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyBxVKKTyzGAcqtaA0TZxODqjyTVfP-Ghzw",
  authDomain: "fir-ai-logic.firebaseapp.com",
  projectId: "fir-ai-logic",
  storageBucket: "fir-ai-logic.firebasestorage.app",
  messagingSenderId: "564839035602",
  appId: "1:564839035602:web:bc241f38f6c57b0692330b"
};

// 1. Initialize Firebase App (Singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. Initialize Auth with Persistence (Expert Recommended Pattern)
export const auth = (() => {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (e) {
    // If it's already been initialized (common during Hot Refresh), return the existing instance
    return getAuth(app);
  }
})();
