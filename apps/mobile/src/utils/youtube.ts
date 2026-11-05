const PATTERNS = [
  /[?&]v=([A-Za-z0-9_-]{6,})/,
  /youtu\.be\/([A-Za-z0-9_-]{6,})/,
  /youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/,
];

/** Extract the 11-char video id from any YouTube URL shape. Null when absent. */
export const extractYouTubeId = (input?: string | null): string | null => {
  if (!input || typeof input !== "string") return null;
  for (const re of PATTERNS) {
    const m = input.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
};

/** Default thumbnail for a video id (no API key needed). */
export const youTubeThumbnail = (videoId?: string | null): string | null =>
  videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
