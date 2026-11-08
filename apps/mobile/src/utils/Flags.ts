import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../api/apiClient";

const KEY = "app:flags";
const INSTALL_KEY = "app:installId";

type FlagValue = boolean | { enabled: boolean; percent?: number };

const DEFAULTS: Record<string, FlagValue> = {
  clubs: true,
  seasons: true,
  betaReader: true,
  podcasts: true,
};

const getInstallId = async (): Promise<string> => {
  try {
    let id = await AsyncStorage.getItem(INSTALL_KEY);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem(INSTALL_KEY, id);
    }
    return id;
  } catch {
    return "default";
  }
};

const hashBucket = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
  return h % 100;
};

export const refreshFlags = async (): Promise<Record<string, FlagValue>> => {
  try {
    const res = await apiClient.get("/app/config");
    const flags = { ...DEFAULTS, ...(res.data?.flags || {}) };
    await AsyncStorage.setItem(KEY, JSON.stringify(flags));
    return flags;
  } catch {
    return getFlags();
  }
};

export const getFlags = async (): Promise<Record<string, FlagValue>> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
};

export const isEnabled = async (flag: string): Promise<boolean> => {
  const v = (await getFlags())[flag];
  if (v === undefined) return true;
  if (typeof v === "boolean") return v;
  if (!v.enabled) return false;
  const pct = v.percent ?? 100;
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  const id = await getInstallId();
  return hashBucket(`${id}:${flag}`) < pct;
};
