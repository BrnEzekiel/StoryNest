import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const Storage = {
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      try {
        await SecureStore.setItemAsync(key, value);
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

  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      try {
        const val = await SecureStore.getItemAsync(key);
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

  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      try {
        await SecureStore.deleteItemAsync(key);
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
