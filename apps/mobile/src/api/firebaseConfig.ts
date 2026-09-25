import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth,
  initializeAuth,
  // @ts-ignore
  getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// --- SECURE CONFIG WITH STABLE FALLBACKS ---
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBxVKKTyzGAcqtaA0TZxODqjyTVfP-Ghzw",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "storynest-12345.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "storynest-12345",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "storynest-12345.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "564839035602",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:564839035602:web:bc241f38f6c57b0692330b"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Improved initialization for React Native
export const auth = (() => {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (e) {
    return getAuth(app);
  }
})();

export default app;
