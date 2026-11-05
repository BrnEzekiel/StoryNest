import { resolvePlaybackSource, isYouTubeOnly, isSampleEpisode } from "../podcasts";

describe("podcasts utils", () => {
  test("resolvePlaybackSource prefers in-app audio", () => {
    expect(
      resolvePlaybackSource({ audioUrl: "https://cdn.example/e.mp3", youtubeId: "abc" })
    ).toEqual({ type: "audio", url: "https://cdn.example/e.mp3" });
  });

  test("resolvePlaybackSource falls back to YouTube url or id", () => {
    expect(resolvePlaybackSource({ youtubeUrl: "https://youtu.be/abc" })).toEqual({
      type: "youtube",
      url: "https://youtu.be/abc",
    });
    expect(resolvePlaybackSource({ youtubeId: "abc" })).toEqual({
      type: "youtube",
      url: "https://youtu.be/abc",
    });
  });

  test("resolvePlaybackSource is null with nothing playable", () => {
    expect(resolvePlaybackSource({})).toBeNull();
    expect(resolvePlaybackSource({ audioUrl: null, youtubeId: null })).toBeNull();
  });

  test("isYouTubeOnly detects app-external episodes", () => {
    expect(isYouTubeOnly({ youtubeId: "abc" })).toBe(true);
    expect(isYouTubeOnly({ audioUrl: "https://cdn.example/e.mp3" })).toBe(false);
    expect(isYouTubeOnly({})).toBe(false);
  });

  test("isSampleEpisode flags legacy bundled samples", () => {
    expect(
      isSampleEpisode({ audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" })
    ).toBe(true);
    expect(isSampleEpisode({ audioUrl: "https://res.cloudinary.com/x/e.mp3" })).toBe(false);
    expect(isSampleEpisode({})).toBe(false);
  });
});
