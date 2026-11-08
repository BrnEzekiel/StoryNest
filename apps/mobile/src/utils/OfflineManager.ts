import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import apiClient from '../api/apiClient';

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;
const INDEX_KEY = 'offline_downloads_index_v2';
const AUTO_KEY = 'offline:autoDownload';

export interface DownloadedChapter {
  id: string;
  title: string;
  body: string;
  order: number;
}

export interface DownloadedStory {
  id: string;
  title: string;
  genre?: string;
  authorName?: string;
  summary?: string;
  readingTime?: number;
  coverUrl?: string | null;
  localCoverPath?: string | null;
  body?: string;
  chapters?: DownloadedChapter[];
  updatedAt?: string;
  sizeBytes?: number;
}

const readIndex = async (): Promise<DownloadedStory[]> => {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeIndex = async (stories: DownloadedStory[]): Promise<void> => {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(stories));
};

export const OfflineManager = {
  async init() {
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
    }
  },

  /** Download a story with cover + all chapter bodies for true offline reading. */
  async downloadStory(story: any): Promise<DownloadedStory> {
    await OfflineManager.init();
    let localCoverPath: string | null = null;
    const liteMode = (await AsyncStorage.getItem("liteMode").catch(() => "false")) === "true";
    if (story.coverUrl && !liteMode) {
      try {
        const ext = story.coverUrl.split('.').pop()?.split('?')[0] || 'jpg';
        localCoverPath = `${DOWNLOADS_DIR}${story.id}_cover.${ext}`;
        await FileSystem.downloadAsync(story.coverUrl, localCoverPath);
      } catch (e) {
        console.error("[OfflineManager] Cover download failed:", e);
        localCoverPath = null;
      }
    }

    let chapters: DownloadedChapter[] = [];
    try {
      const full = await apiClient.get(`/stories/${story.id}`);
      const list = full.data?.chapters || [];
      const bodies = await Promise.all(
        list.slice(0, 50).map(async (c: any) => {
          try {
            const r = await apiClient.get(`/chapters/${c.id}`);
            return { id: c.id, title: c.title, body: r.data?.body || "", order: c.order || 0 };
          } catch {
            return { id: c.id, title: c.title, body: "", order: c.order || 0 };
          }
        })
      );
      chapters = bodies;
    } catch (e) {
      console.error("[OfflineManager] Chapter download failed:", e);
    }

    let coverBytes = 0;
    if (localCoverPath) {
      try {
        const info = await FileSystem.getInfoAsync(localCoverPath);
        if (info.exists && !info.isDirectory) coverBytes = info.size || 0;
      } catch {}
    }
    const textBytes = JSON.stringify({ body: story.body || "", chapters }).length;
    const entry: DownloadedStory = {
      id: story.id,
      title: story.title,
      genre: story.genre,
      authorName: story.authorName,
      summary: story.summary,
      readingTime: story.readingTime,
      coverUrl: story.coverUrl || null,
      localCoverPath,
      body: story.body || "",
      chapters,
      updatedAt: story.updatedAt || new Date().toISOString(),
      sizeBytes: coverBytes + textBytes,
    };
    const index = await readIndex();
    await writeIndex([entry, ...index.filter((s) => s.id !== story.id)]);
    return entry;
  },

  async getDownloadedStories(): Promise<DownloadedStory[]> {
    return readIndex();
  },

  async isDownloaded(storyId: string): Promise<boolean> {
    const index = await readIndex();
    return index.some((s) => s.id === storyId);
  },

  async removeStory(storyId: string): Promise<void> {
    const index = await readIndex();
    const target = index.find((s) => s.id === storyId);
    if (target?.localCoverPath) {
      try {
        await FileSystem.deleteAsync(target.localCoverPath, { idempotent: true });
      } catch (e) {
        console.error("[OfflineManager] Cover delete failed:", e);
      }
    }
    await writeIndex(index.filter((s) => s.id !== storyId));
  },

  async getStorageInfo(): Promise<{ totalBytes: number; count: number; perStory: { id: string; title: string; bytes: number }[] }> {
    const index = await readIndex();
    const perStory = index.map((s) => ({ id: s.id, title: s.title, bytes: s.sizeBytes || 0 }));
    return { totalBytes: perStory.reduce((n, s) => n + s.bytes, 0), count: index.length, perStory };
  },

  /** Remove downloads the reader already finished (progress >= 95). */
  async clearFinished(progressByStory: Record<string, number>): Promise<number> {
    const index = await readIndex();
    const finished = index.filter((s) => (progressByStory[s.id] || 0) >= 95);
    for (const s of finished) {
      await OfflineManager.removeStory(s.id);
    }
    return finished.length;
  },

  async getAutoDownload(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(AUTO_KEY)) === "true";
    } catch {
      return false;
    }
  },

  async setAutoDownload(v: boolean): Promise<void> {
    await AsyncStorage.setItem(AUTO_KEY, v ? "true" : "false");
  },

  /** Refresh bookmarked stories on Wi-Fi when auto-download is on. */
  async autoDownloadBookmarks(): Promise<{ downloaded: number; skipped: boolean }> {
    if (!(await OfflineManager.getAutoDownload())) return { downloaded: 0, skipped: true };
    try {
      const net = await NetInfo.fetch();
      if (net.type !== "wifi") return { downloaded: 0, skipped: true };
      const res = await apiClient.get("/users/me/bookmarks");
      const bookmarks = Array.isArray(res.data) ? res.data : [];
      const index = await readIndex();
      let downloaded = 0;
      for (const b of bookmarks.slice(0, 5)) {
        const story = b.story;
        if (!story?.id) continue;
        const existing = index.find((s) => s.id === story.id);
        const stale = !existing || (story.updatedAt && existing.updatedAt && story.updatedAt > existing.updatedAt);
        if (!stale) continue;
        try {
          await OfflineManager.downloadStory(story);
          downloaded += 1;
        } catch {}
      }
      return { downloaded, skipped: false };
    } catch {
      return { downloaded: 0, skipped: true };
    }
  },
};
