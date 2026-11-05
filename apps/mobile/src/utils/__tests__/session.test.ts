import {
  isDefinitiveRefreshFailure,
  shouldSignOutOnRestoreError,
  markInconclusive,
} from "../session";

describe("session liveness decisions", () => {
  test("isDefinitiveRefreshFailure: only 401/403 kill the session", () => {
    expect(isDefinitiveRefreshFailure({ response: { status: 401 } })).toBe(true);
    expect(isDefinitiveRefreshFailure({ response: { status: 403 } })).toBe(true);
    expect(isDefinitiveRefreshFailure({ response: { status: 500 } })).toBe(false);
    expect(isDefinitiveRefreshFailure({ response: { status: 429 } })).toBe(false);
    expect(isDefinitiveRefreshFailure(new Error("Network request failed"))).toBe(false);
    expect(isDefinitiveRefreshFailure(null)).toBe(false);
    expect(isDefinitiveRefreshFailure(undefined)).toBe(false);
  });

  test("shouldSignOutOnRestoreError: plain 401 signs out, inconclusive 401 keeps session", () => {
    expect(shouldSignOutOnRestoreError({ response: { status: 401 } })).toBe(true);
    const marked: any = { response: { status: 401 } };
    markInconclusive(marked);
    expect(shouldSignOutOnRestoreError(marked)).toBe(false);
    expect(shouldSignOutOnRestoreError({ response: { status: 403 } })).toBe(false);
    expect(shouldSignOutOnRestoreError({ response: { status: 500 } })).toBe(false);
    expect(shouldSignOutOnRestoreError(new Error("timeout"))).toBe(false);
    expect(shouldSignOutOnRestoreError(null)).toBe(false);
  });

  test("markInconclusive is null-safe", () => {
    expect(() => markInconclusive(null)).not.toThrow();
    expect(() => markInconclusive(undefined)).not.toThrow();
  });
});
