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

export function hasToken(): boolean {
  return Boolean(getStoredToken());
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

export type StoryListItem = {
  id: string;
  title?: string;
  description?: string;
  synopsis?: string;
  summary?: string;
  coverUrl?: string;
  coverImage?: string;
  genre?: string;
  authorName?: string;
  author?: { username?: string; name?: string };
  isFeatured?: boolean;
  isDraft?: boolean;
};

export type Chapter = {
  id: string;
  title?: string;
  body?: string;
  content?: string;
  order?: number;
};

export type StoryDetail = {
  id: string;
  title?: string;
  body?: string;
  content?: string;
  summary?: string;
  description?: string;
  synopsis?: string;
  genre?: string;
  coverUrl?: string;
  authorName?: string;
  author?: { username?: string; name?: string };
  chapters?: Chapter[];
  bookmarkProgress?: number;
  isLiked?: boolean;
  canRead?: boolean;
  contentWarnings?: string;
  isAdult?: boolean;
  _count?: { likes?: number };
};

export type BookmarkItem = {
  id?: string;
  storyId: string;
  progress?: number;
  story?: StoryListItem;
  createdAt?: string;
};

function normalizeStoryList(data: unknown): StoryListItem[] {
  if (Array.isArray(data)) return data as StoryListItem[];
  const d = data as { stories?: StoryListItem[]; data?: StoryListItem[] };
  return d.stories || d.data || [];
}

export const api = {
  health: () => apiFetch<{ status: string; version?: string; bullmq?: boolean }>("/health"),

  login: (body: { email: string; password: string }) =>
    apiFetch<{ user: unknown; accessToken: string; refreshToken?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  register: (body: { email: string; password: string; username: string }) =>
    apiFetch<{ user: unknown; accessToken: string; refreshToken?: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  stories: async (params?: { page?: number; limit?: number; q?: string; genre?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.q) q.set("q", params.q);
    if (params?.genre) q.set("genre", params.genre);
    const qs = q.toString();
    const data = await apiFetch(`/stories${qs ? `?${qs}` : ""}`);
    return normalizeStoryList(data);
  },

  story: (id: string) => apiFetch<StoryDetail>(`/stories/${id}`),

  chapter: (id: string) => apiFetch<Chapter>(`/chapters/${id}`),

  markRead: (storyId: string) =>
    apiFetch(`/stories/${storyId}/read`, { method: "POST" }).catch(() => null),

  bookmark: (storyId: string, progress: number) =>
    apiFetch(`/stories/${storyId}/bookmark`, {
      method: "POST",
      body: JSON.stringify({ progress }),
    }),

  myBookmarks: async () => {
    const data = await apiFetch<BookmarkItem[] | { bookmarks?: BookmarkItem[] }>(
      "/users/me/bookmarks"
    );
    if (Array.isArray(data)) return data;
    return (data as { bookmarks?: BookmarkItem[] }).bookmarks || [];
  },

  like: (storyId: string) =>
    apiFetch<{ isLiked?: boolean; likes?: number }>(`/stories/${storyId}/like`, {
      method: "POST",
    }),

  preferences: (body: { readerTheme?: string; readerFontSize?: string }) =>
    apiFetch("/users/me/preferences", {
      method: "POST",
      body: JSON.stringify(body),
    }).catch(() => null),
};
