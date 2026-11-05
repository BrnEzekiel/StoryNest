import apiClient from "../api/apiClient";

/** Minimum gap between server warmup pings. */
export const WARMUP_WINDOW_MS = 30 * 1000;

/** Pure dedupe decision: warm up when never warmed or the window elapsed. */
export const shouldWarmup = (last: number | null, now: number): boolean =>
  last === null || now - last >= WARMUP_WINDOW_MS;

let lastWarmup: number | null = null;

/**
 * Fire-and-forget wake-up ping for a sleeping backend. Auth screens call
 * this on mount so the server is warm by the time the user submits.
 * Never throws, never blocks, deduped to one ping per window.
 */
export const warmupServer = (): void => {
  try {
    const now = Date.now();
    if (!shouldWarmup(lastWarmup, now)) return;
    lastWarmup = now;
    apiClient.get("/health", { timeout: 10000 }).catch(() => {});
  } catch {}
};

/** For tests. */
export const __resetWarmup = (): void => {
  lastWarmup = null;
};
