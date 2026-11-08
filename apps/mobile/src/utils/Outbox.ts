import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

export interface OutboxItem {
  id: string;
  kind: "like" | "unlike" | "bookmark" | "unbookmark" | "comment";
  storyId: string;
  payload?: any;
  ts: number;
}

const KEY = "outbox:queue";

export const Outbox = {
  async list(): Promise<OutboxItem[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async enqueue(item: Omit<OutboxItem, "id" | "ts">): Promise<void> {
    const items = await Outbox.list();
    items.push({ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ts: Date.now() });
    await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(-100)));
  },

  async remove(id: string): Promise<void> {
    const items = await Outbox.list();
    await AsyncStorage.setItem(KEY, JSON.stringify(items.filter((i) => i.id !== id)));
  },

  async isOnline(): Promise<boolean> {
    try {
      const s = await NetInfo.fetch();
      return (s.isConnected ?? true) && (s.isInternetReachable ?? true);
    } catch {
      return true;
    }
  },

  /** Replay queued actions in order. Stops at the first failure; the rest retry later. */
  async flush(runner: (item: OutboxItem) => Promise<void>): Promise<number> {
    if (!(await Outbox.isOnline())) return 0;
    const items = await Outbox.list();
    let done = 0;
    for (const item of items) {
      try {
        await runner(item);
        await Outbox.remove(item.id);
        done += 1;
      } catch {
        break;
      }
    }
    return done;
  },
};
