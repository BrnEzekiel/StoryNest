import TrackPlayer, { Event } from "react-native-track-player";

/**
 * Headless background task: answers the lock-screen / notification buttons
 * (play, pause, next, previous, ±15s, seek bar) even when the app is closed.
 */
export const playbackService = async (): Promise<void> => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event: any) => {
    const pos = await TrackPlayer.getPosition();
    await TrackPlayer.seekTo(pos + (event?.interval ?? 15));
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event: any) => {
    const pos = await TrackPlayer.getPosition();
    await TrackPlayer.seekTo(Math.max(0, pos - (event?.interval ?? 15)));
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, (event: any) =>
    TrackPlayer.seekTo(event?.position ?? 0)
  );
};
