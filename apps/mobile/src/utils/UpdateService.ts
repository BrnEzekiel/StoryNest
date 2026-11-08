/**
 * Self-update orchestrator: StoryNest installs its own updates.
 *
 * 1. OTA (expo-updates): JS-only changes download and apply silently.
 * 2. GitHub APK: native builds download in-app and hand off to the Android
 *    installer (the OS still shows its one-tap system prompt; that part
 *    cannot be skipped without system privileges).
 *
 * Runs once per launch from App.tsx. Respects the Settings auto-install
 * toggle (ON by default); when OFF the user just gets a notice instead.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import {
  fetchLatestRelease,
  isNewerRelease,
  shouldCheckGitHub,
  markGitHubChecked,
  getAutoInstall,
} from "./githubUpdates";
import { resolveUpdateAvailability } from "./updates";

type Notify = (n: { title: string; message: string; variant: string; actions?: any[] }) => void;

let ranThisSession = false;

export const downloadAndInstallApk = async (
  apkUrl: string,
  tag: string,
  onProgress?: (pct: number) => void
): Promise<void> => {
  const safeTag = tag.replace(/[^A-Za-z0-9._-]/g, "_");
  const dest = `${FileSystem.cacheDirectory}storynest-${safeTag}.apk`;
  const existing = await FileSystem.getInfoAsync(dest);
  if (!existing.exists) {
    const download = FileSystem.createDownloadResumable(apkUrl, dest, {}, (data) => {
      if (onProgress && data.totalBytesExpectedToWrite > 0) {
        onProgress(data.totalBytesWritten / data.totalBytesExpectedToWrite);
      }
    });
    const result = await download.downloadAsync();
    if (!result || result.status !== 200) {
      throw new Error(`Download failed (status ${result?.status})`);
    }
  }
  onProgress?.(1);
  const contentUri = await FileSystem.getContentUriAsync(dest);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    flags: 1,
    type: "application/vnd.android.package-archive",
  });
};

export const runAutoUpdate = async (notify: Notify): Promise<void> => {
  if (__DEV__ || ranThisSession) return;
  ranThisSession = true;
  const auto = await getAutoInstall();

  // 1. OTA fast path for JS-only changes.
  try {
    if (resolveUpdateAvailability(__DEV__, Updates.isEnabled) !== "disabled") {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        if (auto) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        } else {
          notify({ title: "Update ready", message: "A new update is waiting in Settings.", variant: "info" });
        }
        return;
      }
    }
  } catch {}

  // 2. Native APK via GitHub releases (Android sideload builds).
  try {
    if (Platform.OS !== "android") return;
    if (!(await shouldCheckGitHub())) return;
    const rel = await fetchLatestRelease();
    if (!rel) return;
    const current = Constants.expoConfig?.version ?? "0.0.0";
    if (!isNewerRelease(rel.tag, current)) {
      await markGitHubChecked(rel.tag);
      return;
    }
    const isNew = await markGitHubChecked(rel.tag);
    if (auto && rel.apkUrl) {
      await downloadAndInstallApk(rel.apkUrl, rel.tag);
    } else if (isNew) {
      notify({
        title: "New release available",
        message: `${rel.name} is out. Open Settings to install it.`,
        variant: "info",
      });
    }
  } catch {}
};
