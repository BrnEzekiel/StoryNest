jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

import {
  compareVersions,
  isNewerRelease,
  fetchLatestRelease,
} from "../githubUpdates";

describe("compareVersions", () => {
  test("orders plain versions numerically (not lexicographically)", () => {
    expect(compareVersions("1.0.6", "1.0.6")).toBe(0);
    expect(compareVersions("1.0.10", "1.0.6")).toBe(1);
    expect(compareVersions("1.0.6", "1.0.10")).toBe(-1);
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
  });

  test("tolerates v prefixes, whitespace, and uneven depth", () => {
    expect(compareVersions("v1.0.6", "1.0.6")).toBe(0);
    expect(compareVersions(" 1.1 ", "1.0.9")).toBe(1);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.0.1", "1.0")).toBe(1);
  });
});

describe("isNewerRelease", () => {
  test("flags newer tags only", () => {
    expect(isNewerRelease("v1.0.7", "1.0.6")).toBe(true);
    expect(isNewerRelease("v1.0.6", "1.0.6")).toBe(false);
    expect(isNewerRelease("v1.0.5", "1.0.6")).toBe(false);
  });
});

describe("fetchLatestRelease", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    (global as any).fetch = realFetch;
  });

  test("parses the latest release", async () => {
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        tag_name: "v1.0.7",
        name: "StoryNest 1.0.7",
        html_url: "https://github.com/BrnEzekiel/StoryNest/releases/tag/v1.0.7",
        published_at: "2026-11-05T00:00:00Z",
      }),
    }));
    const rel = await fetchLatestRelease();
    expect(rel).toEqual({
      tag: "v1.0.7",
      name: "StoryNest 1.0.7",
      url: "https://github.com/BrnEzekiel/StoryNest/releases/tag/v1.0.7",
      publishedAt: "2026-11-05T00:00:00Z",
    });
  });

  test("returns null on HTTP errors, malformed bodies, and network failure", async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: false }));
    expect(await fetchLatestRelease()).toBeNull();

    (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
    expect(await fetchLatestRelease()).toBeNull();

    (global as any).fetch = jest.fn(async () => {
      throw new Error("offline");
    });
    expect(await fetchLatestRelease()).toBeNull();
  });
});
