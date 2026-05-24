import { Platform } from 'react-native';
import axios from 'axios';

const BACKEND_URL = 'http://192.168.100.5:5000'; 

export const logErrorToBackend = async (error: any, isFatal: boolean = false) => {
  try {
    const errorData = {
      error: error?.message || String(error),
      stack: error?.stack || 'No stack trace available',
      device: `${Platform.OS} ${Platform.Version || ''}`,
      timestamp: new Date().toISOString(),
      isFatal,
    };
    await axios.post(`${BACKEND_URL}/logs/error`, errorData);
  } catch (e) {}
};

export const initGlobalHandler = () => {
  // Global Handler for Android/iOS
  if (Platform.OS !== 'web') {
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      logErrorToBackend(error, isFatal);
      if (originalHandler) originalHandler(error, isFatal);
    });
  }

  // Global Handler for Web
  if (Platform.OS === 'web') {
    window.addEventListener('error', (event) => {
      logErrorToBackend(event.error || event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      logErrorToBackend(event.reason);
    });
  }
};
