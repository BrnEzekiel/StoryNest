/**
 * Session-liveness decisions shared by the API client and the auth gate.
 *
 * A 401 signs the user out ONLY when it is definitive: the server rejected
 * the credentials themselves. Timeouts, offline blips, and sleepy servers
 * during a token refresh prove nothing and must keep the local session.
 */

/** Flag an error whose 401 must NOT sign the user out. */
export const markInconclusive = (error: unknown): void => {
  if (error && typeof error === "object") {
    (error as Record<string, unknown>).sessionDefinitive = false;
  }
};

/** True when a failed token refresh definitively kills the session. */
export const isDefinitiveRefreshFailure = (refreshError: unknown): boolean => {
  const status = (refreshError as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
};

/** True when a restore-time error definitively proves the session is dead. */
export const shouldSignOutOnRestoreError = (error: unknown): boolean =>
  (error as { response?: { status?: number }; sessionDefinitive?: boolean })?.response?.status === 401 &&
  (error as { sessionDefinitive?: boolean })?.sessionDefinitive !== false;
