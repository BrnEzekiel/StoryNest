import { Platform } from 'react-native';
import axios from 'axios';
import { BASE_URL } from '../api/apiClient';

let isInitialized = false;
let isLogging = false;

export const logErrorToBackend = async (error: any, isFatal: boolean = false) => {
  if (isLogging) return; // Prevent recursive logging
  isLogging = true;
  
  try {
    const errorData = {
      error: error?.message || String(error),
      stack: error?.stack || 'No stack trace available',
      device: `${Platform.OS} ${Platform.Version || ''}`,
      timestamp: new Date().toISOString(),
      isFatal,
    };
    await axios.post(`${BASE_URL}/logs/error`, errorData, { timeout: 5000 });
  } catch (e) {
    console.log('[ErrorHandler] Failed to log to backend:', (e as any)?.message);
  } finally {
    isLogging = false;
  }
};

export const initGlobalHandler = () => {
  if (isInitialized) return;
  isInitialized = true;

  // Global Handler for Android/iOS
  if (Platform.OS !== 'web') {
    try {
      // @ts-ignore
      if (typeof ErrorUtils !== 'undefined' && ErrorUtils.getGlobalHandler) {
        // @ts-ignore
        const originalHandler = ErrorUtils.getGlobalHandler();
        // @ts-ignore
        ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
          console.log('[GlobalError]', error?.message || error);
          logErrorToBackend(error, isFatal).catch(() => {});
          if (originalHandler) originalHandler(error, isFatal);
        });
      }
    } catch (err) {
      console.log('[ErrorHandler] Error initializing global handler:', err);
    }
  }

  // Global Handler for Web
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      logErrorToBackend(event.error || event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      logErrorToBackend(event.reason);
    });
  }
};
