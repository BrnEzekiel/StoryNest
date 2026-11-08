/**
 * Local engagement engine: streak nudges, chapter alerts, reply alerts,
 * weekly digests, and price-drop alerts — all scheduled on-device.
 * Honors granular prefs + quiet hours from Settings.
 */
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../api/apiClient";
import { ActivityLog } from "./activityLog";

export interface EngagePrefs {
  chapters: boolean;
  streak: boolean;
  replies: boolean;
  digest: boolean;
  deals: boolean;
  quietStart: number; // hour 0-23, -1 = off
  quietEnd: number; // hour 0-23
}

const PREFS_KEY = "engage:prefs";
const IDS_KEY = "engage:scheduledIds";
const SEEN_UPDATES_KEY = "engage:seenUpdates";
const SEEN_COUNTS_KEY = "engage:seenCounts";
const WATCH_KEY = "engage:watchlist";

const DEFAULTS: EngagePrefs = {
  chapters: true,
  streak: true,
  replies: true,
  digest: true,
  deals: true,
  quietStart: 22,
  quietEnd: 7,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
} as any);

export const getEngagePrefs = async (): Promise<EngagePrefs> => {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
};

export const setEngagePrefs = async (prefs: Partial<EngagePrefs>): Promise<EngagePrefs> => {
  const next = { ...(await getEngagePrefs()), ...prefs };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
};

const inQuietHours = (date: Date, prefs: EngagePrefs): boolean => {
  if (prefs.quietStart < 0) return false;
  const h = date.getHours();
  if (prefs.quietStart <= prefs.quietEnd) return h >= prefs.quietStart && h < prefs.quietEnd;
  return h >= prefs.quietStart || h < prefs.quietEnd;
};

const shiftOutOfQuiet = (hour: number, minute: number, prefs: EngagePrefs): { hour: number; minute: number } => {
  const probe = new Date();
  probe.setHours(hour, minute, 0, 0);
  if (!inQuietHours(probe, prefs)) return { hour, minute };
  return { hour: prefs.quietEnd, minute: 5 };
};

export const scheduleRecurring = async (): Promise<void> => {
  try {
    const granted = await Notifications.getPermissionsAsync();
    if (granted.status !== "granted") return;
    const prefs = await getEngagePrefs();
    let old: string[] = [];
    try { old = JSON.parse((await AsyncStorage.getItem(IDS_KEY)) || "[]"); } catch {}
    for (const id of old) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    }
    const ids: string[] = [];

    if (prefs.streak) {
      const t = shiftOutOfQuiet(20, 0, prefs);
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: "Keep your streak alive", body: "Read a few minutes tonight to keep it going." },
        trigger: { hour: t.hour, minute: t.minute, repeats: true } as any,
      });
      ids.push(id);
    }

    if (prefs.digest) {
      const journal: any[] = await ActivityLog.list().catch(() => []);
      const weekAgo = Date.now() - 7 * 86400000;
      const reads = journal.filter((e) => e.kind === "READ" && (e.ts || 0) >= weekAgo).length;
      const t = shiftOutOfQuiet(9, 0, prefs);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Your weekly reading digest",
          body: reads > 0 ? `You read ${reads} stor${reads === 1 ? "y" : "ies"} this week. Nice work.` : "New stories are waiting in your genres this week.",
        },
        trigger: { weekday: 2, hour: t.hour, minute: t.minute, repeats: true } as any,
      });
      ids.push(id);
    }

    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
  } catch {}
};

const readMap = async (key: string): Promise<Record<string, any>> => {
  try {
    return JSON.parse((await AsyncStorage.getItem(key)) || "{}");
  } catch {
    return {};
  }
};

/** Foreground checks: new chapters, comment replies, price drops. Call on launch + foreground. */
export const foregroundChecks = async (): Promise<void> => {
  try {
    const granted = await Notifications.getPermissionsAsync();
    if (granted.status !== "granted") return;
    const prefs = await getEngagePrefs();
    if (inQuietHours(new Date(), prefs)) return;

    if (prefs.chapters) {
      const seen = await readMap(SEEN_UPDATES_KEY);
      const res = await apiClient.get("/users/me/bookmarks").catch(() => null);
      const bookmarks = Array.isArray(res?.data) ? res.data : [];
      const fresh: Record<string, any> = {};
      const updated: string[] = [];
      for (const b of bookmarks) {
        const s = b.story;
        if (!s?.id) continue;
        fresh[s.id] = s.updatedAt;
        if (seen[s.id] && s.updatedAt && s.updatedAt > seen[s.id]) updated.push(s.title);
      }
      await AsyncStorage.setItem(SEEN_UPDATES_KEY, JSON.stringify(fresh));
      if (Object.keys(seen).length > 0 && updated.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "New chapters are out",
            body: updated.length === 1 ? `${updated[0]} just updated.` : `${updated.length} of your stories updated.`,
          },
          trigger: null,
        });
      }
    }

    if (prefs.replies) {
      const seen = await readMap(SEEN_COUNTS_KEY);
      const res = await apiClient.get("/admin/stories").catch(() => null);
      const mine = Array.isArray(res?.data) ? res.data.slice(0, 5) : [];
      const fresh: Record<string, any> = {};
      let added = 0;
      for (const s of mine) {
        try {
          const full = await apiClient.get(`/stories/${s.id}`);
          const count = full.data?._count?.comments || 0;
          fresh[s.id] = count;
          if (typeof seen[s.id] === "number" && count > seen[s.id]) added += count - seen[s.id];
        } catch {}
      }
      if (Object.keys(fresh).length > 0) await AsyncStorage.setItem(SEEN_COUNTS_KEY, JSON.stringify({ ...seen, ...fresh }));
      if (Object.keys(seen).length > 0 && added > 0) {
        await Notifications.scheduleNotificationAsync({
          content: { title: "New comments", body: `${added} new comment${added === 1 ? "" : "s"} on your stories.` },
          trigger: null,
        });
      }
    }

    if (prefs.deals) {
      const watch = await readMap(WATCH_KEY);
      const ids = Object.keys(watch);
      for (const id of ids.slice(0, 5)) {
        try {
          const full = await apiClient.get(`/stories/${id}`);
          const price = full.data?.price;
          if (typeof price === "number" && typeof watch[id]?.price === "number" && price < watch[id].price) {
            await Notifications.scheduleNotificationAsync({
              content: { title: "Price drop", body: `${watch[id].title || "A watched story"} is now cheaper.` },
              trigger: null,
            });
            watch[id] = { ...watch[id], price };
          }
        } catch {}
      }
      await AsyncStorage.setItem(WATCH_KEY, JSON.stringify(watch));
    }
  } catch {}
};

export const watchStory = async (storyId: string, price: number, title: string): Promise<void> => {
  const watch = await readMap(WATCH_KEY);
  watch[storyId] = { price, title };
  await AsyncStorage.setItem(WATCH_KEY, JSON.stringify(watch));
};

export const unwatchStory = async (storyId: string): Promise<void> => {
  const watch = await readMap(WATCH_KEY);
  delete watch[storyId];
  await AsyncStorage.setItem(WATCH_KEY, JSON.stringify(watch));
};

export const isWatched = async (storyId: string): Promise<boolean> => {
  const watch = await readMap(WATCH_KEY);
  return !!watch[storyId];
};
