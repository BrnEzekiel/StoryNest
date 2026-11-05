import TrackPlayer, {
  Capability,
  State,
  AppKilledPlaybackBehavior,
} from "react-native-track-player";

export interface QueueEpisode {
  id: string;
  title?: string | null;
  blurb?: string | null;
  audioUrl: string;
  thumbnailUrl?: string | null;
  author?: string | null;
}

let isSetup = false;

/** One-time player init + notification buttons (idempotent). */
export const setupAudioPlayer = async (): Promise<void> => {
  if (isSetup) return;
  try {
    await TrackPlayer.setupPlayer();
  } catch (e: any) {
    if (!String(e?.message || "").toLowerCase().includes("already")) throw e;
  }
  await TrackPlayer.updateOptions({
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
    },
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.JumpForward,
      Capability.JumpBackward,
      Capability.SeekTo,
    ],
    compactCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.JumpForward,
      Capability.JumpBackward,
    ],
    forwardJumpInterval: 15,
    backwardJumpInterval: 15,
  });
  isSetup = true;
};

const toTrack = (ep: QueueEpisode) => ({
  id: ep.id,
  url: ep.audioUrl,
  title: ep.title || "Episode",
  artist: ep.author || "StoryNest",
  artwork: ep.thumbnailUrl || undefined,
});

/** Play one episode with the rest queued behind it (auto-continues). */
export const playEpisodeQueue = async (
  episode: QueueEpisode,
  upNext: QueueEpisode[]
): Promise<void> => {
  await setupAudioPlayer();
  await TrackPlayer.reset();
  await TrackPlayer.add([toTrack(episode), ...upNext.map(toTrack)]);
  await TrackPlayer.play();
};

/** Toggle play/pause. Resolves true when now playing. */
export const togglePlayback = async (): Promise<boolean> => {
  const s = await TrackPlayer.getPlaybackState();
  if (s.state === State.Playing || s.state === State.Buffering) {
    await TrackPlayer.pause();
    return false;
  }
  await TrackPlayer.play();
  return true;
};

export const seekBy = async (seconds: number): Promise<void> => {
  const pos = await TrackPlayer.getPosition();
  const dur = await TrackPlayer.getDuration();
  const next = Math.min(Math.max(0, pos + seconds), dur > 0 ? dur : pos + seconds);
  await TrackPlayer.seekTo(next);
};

export const RATES = [1, 1.25, 1.5, 1.75, 2];

export const nextRate = async (current: number): Promise<number> => {
  const i = RATES.indexOf(current);
  const rate = RATES[(i + 1) % RATES.length] ?? 1;
  await TrackPlayer.setRate(rate);
  return rate;
};

// Sleep timer (module-level so it survives screen unmounts).
let sleepTimer: ReturnType<typeof setTimeout> | null = null;
let sleepEndsAt = 0;

export const setSleepTimer = (minutes: number): void => {
  clearSleepTimer();
  if (minutes <= 0) return;
  sleepEndsAt = Date.now() + minutes * 60000;
  sleepTimer = setTimeout(async () => {
    sleepTimer = null;
    sleepEndsAt = 0;
    try {
      await TrackPlayer.pause();
    } catch {}
  }, minutes * 60000);
};

export const clearSleepTimer = (): void => {
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = null;
  sleepEndsAt = 0;
};

export const getSleepRemainingMin = (): number =>
  sleepEndsAt > Date.now() ? Math.ceil((sleepEndsAt - Date.now()) / 60000) : 0;
