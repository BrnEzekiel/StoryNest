import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "@sn_cache:";
const mem = new Map<string, { data: any; ts: number }>();

interface CacheEnvelope {
  ts: number;
  data: any;
}

/**
 * Tiny stale-while-revalidate cache: memory first, AsyncStorage second.
 * Screens render cached data instantly (no spinners) and refresh silently.
 */
export const Cache = {
  /** Fresh value or null when missing/stale. */
  getFresh: async <T>(key: string, ttlMs: number): Promise<T | null> => {
    const now = Date.now();
    const m = mem.get(key);
    if (m && now - m.ts < ttlMs) return m.data as T;
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const env = JSON.parse(raw) as CacheEnvelope;
      if (now - env.ts >= ttlMs) return null;
      mem.set(key, { data: env.data, ts: env.ts });
      return env.data as T;
    } catch {
      return null;
    }
  },

  /** Last-known value regardless of age (for instant paint). */
  getStale: async <T>(key: string): Promise<T | null> => {
    const m = mem.get(key);
    if (m) return m.data as T;
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const env = JSON.parse(raw) as CacheEnvelope;
      mem.set(key, { data: env.data, ts: env.ts });
      return env.data as T;
    } catch {
      return null;
    }
  },

  set: async (key: string, data: any): Promise<void> => {
    const ts = Date.now();
    mem.set(key, { data, ts });
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ ts, data } as CacheEnvelope));
    } catch {}
  },

  remove: async (key: string): Promise<void> => {
    mem.delete(key);
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {}
  },

  /** For tests. */
  __clearMemory: () => mem.clear(),
};
