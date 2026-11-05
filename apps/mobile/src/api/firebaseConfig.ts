import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// NOTE: On Android, the native Firebase SDK uses google-services.json directly.
// The JS SDK config below is used for Auth (email/password, Google Sign-In).
// API key must match google-services.json → client → api_key → current_key.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAQTX4YWJKdG-H-mj4tEB-0EwbDHwvS_Pk",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "storynest-12345.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "storynest-12345",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "storynest-12345.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "564839035602",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:564839035602:web:bc241f38f6c57b0692330b",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Robust auth initialization — avoids crashing if already initialized
export const auth = (() => {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require('firebase/auth');
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e: any) {
    // Already initialized or persistence not available — fall back gracefully
    console.log('[Firebase] Auth init fallback:', e?.message);
    return getAuth(app);
  }
})();

export default app;
