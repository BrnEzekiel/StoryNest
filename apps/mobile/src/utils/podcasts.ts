export interface EpisodeLike {
  id?: string;
  audioUrl?: string | null;
  youtubeUrl?: string | null;
  youtubeId?: string | null;
}

export interface PlaybackSource {
  type: "audio" | "youtube";
  url: string;
}

/** Episodes that can only open in the YouTube app (no in-app stream). */
export const isYouTubeOnly = (item: EpisodeLike): boolean =>
  !item.audioUrl && !!(item.youtubeUrl || item.youtubeId);

/** Where playback should go: in-app audio, the YouTube app, or nowhere. */
export const resolvePlaybackSource = (item: EpisodeLike): PlaybackSource | null => {
  if (item.audioUrl) return { type: "audio", url: item.audioUrl };
  const yt = item.youtubeUrl || (item.youtubeId ? `https://youtu.be/${item.youtubeId}` : null);
  return yt ? { type: "youtube", url: yt } : null;
};

/** Sample episodes bundled with old builds: never show or cache these. */
export const isSampleEpisode = (item: EpisodeLike): boolean =>
  (item.audioUrl || "").includes("soundhelix.com");
