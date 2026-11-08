import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "prefs:dataSaver";

export const getDataSaver = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(KEY)) === "true";
  } catch {
    return false;
  }
};

export const setDataSaver = async (v: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, v ? "true" : "false");
  } catch {}
};
