import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const Storage = {
  setItem: async (key: string, value: string) => {
    try {
        if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
        } else {
            await SecureStore.setItemAsync(key, value);
        }
    } catch (e) {
        console.error(`[Storage] Set Error (${key}):`, e.message);
    }
  },
  getItem: async (key: string) => {
    try {
        if (Platform.OS === 'web') {
            return localStorage.getItem(key);
        }
        return await SecureStore.getItemAsync(key);
    } catch (e) {
        console.error(`[Storage] Get Error (${key}):`, e.message);
        return null;
    }
  },
  removeItem: async (key: string) => {
    try {
        if (Platform.OS === 'web') {
            localStorage.removeItem(key);
        } else {
            await SecureStore.deleteItemAsync(key);
        }
    } catch (e) {
        console.error(`[Storage] Remove Error (${key}):`, e.message);
    }
  }
};
