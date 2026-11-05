/**
 * Client-side rate limiting: sliding-window counters + tap throttles.
 * Pure logic (injectable clock) so it is unit-testable.
 */

const buckets = new Map<string, number[]>();
const lastTap = new Map<string, number>();

export interface LimitVerdict {
  allowed: boolean;
  /** Milliseconds until the oldest hit in the window expires (0 when allowed). */
  retryAfterMs: number;
}

/**
 * Sliding window: allow at most `max` hits per `windowMs`.
 * Records a hit when allowed.
 */
export function checkLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now()
): LimitVerdict {
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) || []).filter((t) => t > cutoff);
  if (hits.length < max) {
    hits.push(now);
    buckets.set(key, hits);
    return { allowed: true, retryAfterMs: 0 };
  }
  buckets.set(key, hits);
  return { allowed: false, retryAfterMs: Math.max(0, hits[0] + windowMs - now) };
}

/**
 * Leading-edge tap throttle: allow at most one action per `intervalMs`.
 * Returns true when the tap may proceed.
 */
export function tapThrottle(key: string, intervalMs: number, now: number = Date.now()): boolean {
  const last = lastTap.get(key);
  if (last !== undefined && now - last < intervalMs) return false;
  lastTap.set(key, now);
  return true;
}

/** Reset all counters (tests / logout). */
export function resetLimits(): void {
  buckets.clear();
  lastTap.clear();
}

/** App-wide presets: [max hits, window ms]. */
export const LIMITS = {
  login: { max: 5, windowMs: 60_000 },
  otpResend: { max: 3, windowMs: 5 * 60_000 },
  comment: { max: 10, windowMs: 60_000 },
  message: { max: 20, windowMs: 60_000 },
  like: { max: 30, windowMs: 60_000 },
  follow: { max: 30, windowMs: 60_000 },
  refresh: { max: 10, windowMs: 60_000 },
} as const;

/** Minimum gap between repeated taps of the same action button. */
export const TAP_GAP_MS = 1500;
