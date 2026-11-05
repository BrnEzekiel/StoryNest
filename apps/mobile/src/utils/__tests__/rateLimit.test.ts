import { checkLimit, tapThrottle, resetLimits, LIMITS } from "../rateLimit";

describe("rateLimit", () => {
  beforeEach(() => resetLimits());

  it("allows up to max hits inside the window, then blocks", () => {
    const t = 1_000_000;
    for (let i = 0; i < LIMITS.comment.max; i++) {
      expect(checkLimit("c1", LIMITS.comment.max, LIMITS.comment.windowMs, t + i).allowed).toBe(true);
    }
    const blocked = checkLimit("c1", LIMITS.comment.max, LIMITS.comment.windowMs, t + 100);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("slides the window: old hits expire and allow again", () => {
    const t = 2_000_000;
    expect(checkLimit("c2", 1, 1000, t).allowed).toBe(true);
    expect(checkLimit("c2", 1, 1000, t + 500).allowed).toBe(false);
    // After the window passes, the old hit is pruned.
    expect(checkLimit("c2", 1, 1000, t + 1001).allowed).toBe(true);
  });

  it("reports retryAfterMs until the oldest hit expires", () => {
    const t = 3_000_000;
    checkLimit("c3", 1, 5000, t);
    const v = checkLimit("c3", 1, 5000, t + 2000);
    expect(v.allowed).toBe(false);
    expect(v.retryAfterMs).toBe(3000);
  });

  it("keeps buckets independent per key", () => {
    const t = 4_000_000;
    expect(checkLimit("a", 1, 60_000, t).allowed).toBe(true);
    expect(checkLimit("b", 1, 60_000, t).allowed).toBe(true);
    expect(checkLimit("a", 1, 60_000, t + 1).allowed).toBe(false);
  });

  it("tapThrottle allows leading tap then blocks within the gap", () => {
    const t = 5_000_000;
    expect(tapThrottle("send", 1500, t)).toBe(true);
    expect(tapThrottle("send", 1500, t + 500)).toBe(false);
    expect(tapThrottle("send", 1500, t + 1500)).toBe(true);
  });

  it("resetLimits clears everything", () => {
    const t = 6_000_000;
    checkLimit("r", 1, 60_000, t);
    tapThrottle("r", 60_000, t);
    resetLimits();
    expect(checkLimit("r", 1, 60_000, t + 1).allowed).toBe(true);
    expect(tapThrottle("r", 60_000, t + 1)).toBe(true);
  });
});
