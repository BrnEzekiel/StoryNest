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

/**
 * Returns a warm, reassuring, user-friendly error message,
 * abstracting away raw status codes (500, 404), stack traces, and alarming technical jargon.
 */
export const getFriendlyErrorMessage = (error: any, fallback: string = "Something went wrong. Please try again in a moment."): string => {
  if (!error) return fallback;

  // If backend provided a custom user-facing message, check if it's already clean
  const backendMsg = error.response?.data?.error || error.response?.data?.message;
  if (backendMsg && typeof backendMsg === 'string') {
    const lower = backendMsg.toLowerCase();
    if (!lower.includes('status code') && 
        !lower.includes('internal server') &&
        !lower.includes('prisma') &&
        !lower.includes('syntaxerror') &&
        !lower.includes('object') &&
        !lower.includes('token') &&
        !lower.includes('jwt')) {
      return backendMsg;
    }
  }

  const status = error.response?.status;
  if (status === 400) return "Please check your details and try again.";
  if (status === 401) return "Incorrect email or password. Please check your details.";
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 404) return "We couldn't find the requested account or item.";
  if (status === 429) return "Too many attempts. Please take a quick breath and try again in a minute.";
  if (status >= 500) return "StoryNest is waking up and refreshing. Please try again in a few moments.";

  // Network / Axios
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return "Connection is taking longer than usual. Please try again.";
  }
  if (error.message?.includes('Network Error') || error.code === 'ERR_NETWORK') {
    return "Unable to reach StoryNest. Please check your internet connection.";
  }

  // Firebase Auth Error Codes
  const code = error.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return "Incorrect email or password. Tap 'Forgot Password?' if you need help.";
  }
  if (code === 'auth/user-not-found') {
    return "We couldn't find an account with that email.";
  }
  if (code === 'auth/email-already-in-use') {
    return "This email is already in use. Try logging in instead.";
  }
  if (code === 'auth/weak-password') {
    return "Please choose a password with at least 6 characters.";
  }
  if (code === 'auth/invalid-email') {
    return "Please enter a valid email address.";
  }
  if (code === 'auth/too-many-requests') {
    return "Too many attempts. Please wait a moment before trying again.";
  }

  return fallback;
};
