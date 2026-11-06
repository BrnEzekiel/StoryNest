import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { withTimeout } from "./promise";

// The system keystore can stall forever on some devices (seen as the app
// freezing on "VERIFIED! ENTERING NEST"). Every SecureStore call gets a hard
// deadline and then falls back to AsyncStorage instead of hanging the app.
const SECURE_STORE_TIMEOUT_MS = 8000;

export const Storage = {
  setItem: async (key: string, value: string, timeoutMs: number = SECURE_STORE_TIMEOUT_MS): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      try {
        await withTimeout(SecureStore.setItemAsync(key, value), timeoutMs, `SecureStore set ${key} timed out`);
      } catch (secErr) {
        // Fallback to AsyncStorage on older Android versions or devices without KeyStore
        await AsyncStorage.setItem(key, value);
      }
    } catch (e: any) {
      console.error(`[Storage] Set Error (${key}):`, e.message);
      try {
        await AsyncStorage.setItem(key, value);
      } catch (fallbackErr) {}
    }
  },

  getItem: async (key: string, timeoutMs: number = SECURE_STORE_TIMEOUT_MS): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      try {
        const val = await withTimeout(SecureStore.getItemAsync(key), timeoutMs, `SecureStore get ${key} timed out`);
        if (val !== null) return val;
      } catch (secErr) {
        // Fallback to AsyncStorage
        return await AsyncStorage.getItem(key);
      }
      // If not found in SecureStore, check AsyncStorage
      return await AsyncStorage.getItem(key);
    } catch (e: any) {
      console.error(`[Storage] Get Error (${key}):`, e.message);
      try {
        return await AsyncStorage.getItem(key);
      } catch (fallbackErr) {
        return null;
      }
    }
  },

  removeItem: async (key: string, timeoutMs: number = SECURE_STORE_TIMEOUT_MS): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      try {
        await withTimeout(SecureStore.deleteItemAsync(key), timeoutMs, `SecureStore delete ${key} timed out`);
      } catch (secErr) {}
      await AsyncStorage.removeItem(key);
    } catch (e: any) {
      console.error(`[Storage] Remove Error (${key}):`, e.message);
      try {
        await AsyncStorage.removeItem(key);
      } catch (fallbackErr) {}
    }
  }
};
