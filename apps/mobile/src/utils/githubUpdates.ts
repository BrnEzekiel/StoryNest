/**
 * GitHub Release watcher: compares the installed version against the latest
 * published GitHub release, so APK installs (which OTA updates cannot
 * upgrade) still learn about new native builds.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const GITHUB_REPO = "BrnEzekiel/StoryNest";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const LAST_SEEN_KEY = "github:lastSeenTag";
const LAST_CHECK_KEY = "github:lastCheckAt";
export const GITHUB_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

export interface ReleaseInfo {
  tag: string;
  name: string;
  url: string;
  publishedAt: string;
}

/** Numeric version compare: 1 if a>b, -1 if a<b, 0 if equal. Tolerates "v" prefixes. */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.trim().replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.trim().replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
};

export const isNewerRelease = (tag: string, currentVersion: string): boolean =>
  compareVersions(tag, currentVersion) > 0;

export const fetchLatestRelease = async (): Promise<ReleaseInfo | null> => {
  try {
    const res = await fetch(RELEASES_URL, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || typeof j.tag_name !== "string") return null;
    return { tag: j.tag_name, name: j.name || j.tag_name, url: j.html_url, publishedAt: j.published_at };
  } catch {
    return null;
  }
};

export const shouldCheckGitHub = async (now: number = Date.now()): Promise<boolean> => {
  try {
    const last = await AsyncStorage.getItem(LAST_CHECK_KEY);
    return !last || now - parseInt(last, 10) > GITHUB_CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
};

/** Records the check; resolves true when `tag` is newly seen (time to radiate). */
export const markGitHubChecked = async (tag: string | null, now: number = Date.now()): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(LAST_CHECK_KEY, String(now));
    if (!tag) return false;
    const seen = await AsyncStorage.getItem(LAST_SEEN_KEY);
    if (seen !== tag) {
      await AsyncStorage.setItem(LAST_SEEN_KEY, tag);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
