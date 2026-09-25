/**
 * StoryNest API client — talks to the existing Express backend.
 * Auth: Bearer JWT (mobile-compatible). Web can later switch to httpOnly cookies.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export type ApiError = {
  error?: string;
  message?: string;
  detail?: string;
};

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sn_access_token");
}

export function setTokens(access: string, refresh?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("sn_access_token", access);
  if (refresh) localStorage.setItem("sn_refresh_token", refresh);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("sn_access_token");
  localStorage.removeItem("sn_refresh_token");
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = data as ApiError;
    throw new Error(err.error || err.message || err.detail || `Request failed (${res.status})`);
  }

  return data as T;
}

export const api = {
  health: () => apiFetch<{ status: string; version?: string; bullmq?: boolean }>("/health"),
  login: (body: { email: string; password: string }) =>
    apiFetch<{ user: unknown; accessToken: string; refreshToken?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  register: (body: {
    email: string;
    password: string;
    username: string;
  }) =>
    apiFetch<{ user: unknown; accessToken: string; refreshToken?: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  stories: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiFetch(`/stories${qs ? `?${qs}` : ""}`);
  },
  story: (id: string) => apiFetch(`/stories/${id}`),
};
