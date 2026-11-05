import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../api/apiClient";

// The server logs these itself when the action hits the API; syncing them
// from here too would double-count them in the feed.
const SERVER_LOGGED: ReadonlySet<ActivityKind> = new Set(["LIKE", "COMMENT", "PUBLISH"]);

export type ActivityKind =
  | "READ"
  | "LIKE"
  | "COMMENT"
  | "BOOKMARK"
  | "MESSAGE"
  | "PLAYLIST"
  | "PODCAST"
  | "UNLOCK"
  | "REFERRAL"
  | "PUBLISH";

export interface JournalEntry {
  id: string;
  ts: number;
  kind: ActivityKind;
  /** Headline: story title, message peer, playlist name... */
  title: string;
  /** Detail: comment excerpt, chapter title... */
  sub?: string;
  storyId?: string;
  coverUrl?: string;
  username?: string;
  avatarUrl?: string | null;
}

const KEY = "@sn_activity_journal";
const MAX_ENTRIES = 200;

let mem: JournalEntry[] | null = null;

const load = async (): Promise<JournalEntry[]> => {
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    mem = Array.isArray(parsed) ? parsed : [];
  } catch {
    mem = [];
  }
  return mem;
};

const persist = async (entries: JournalEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(entries));
  } catch {}
};

/**
 * On-device journal of everything the user does in the app. The activity
 * feed paints from this instantly (no network wait) and it survives restarts.
 */
export const ActivityLog = {
  /** Append an entry (newest first, capped). Never throws. */
  log: async (entry: Omit<JournalEntry, "id" | "ts">): Promise<void> => {
    try {
      const entries = await load();
      const full: JournalEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
      };
      mem = [full, ...entries].slice(0, MAX_ENTRIES);
      await persist(mem);
      if (!SERVER_LOGGED.has(entry.kind)) {
        apiClient
          .post("/activity/log", { kind: entry.kind, title: entry.title, sub: entry.sub, storyId: entry.storyId })
          .catch(() => {});
      }
    } catch {}
  },

  /** Newest-first entries. */
  list: async (): Promise<JournalEntry[]> => [...(await load())],

  clear: async (): Promise<void> => {
    mem = [];
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {}
  },

  /** For tests. */
  __resetCache: () => {
    mem = null;
  },
};
