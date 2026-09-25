/**
 * StoryNest API client — talks to the existing Express backend.
 * Auth: Bearer JWT (mobile-compatible).
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
  isFlagged?: boolean;
  publishedAt?: string | null;
};

export type Chapter = {
  id: string;
  title?: string;
  body?: string;
  content?: string;
  order?: number;
  publishedAt?: string | null;
  isDraft?: boolean;
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
  isDraft?: boolean;
  isFlagged?: boolean;
  _count?: { likes?: number };
};

export type BookmarkItem = {
  id?: string;
  storyId: string;
  progress?: number;
  story?: StoryListItem;
  createdAt?: string;
};

export type AdminStats = {
  storyCount?: number;
  totalReads?: number;
  userCount?: number;
};

export type AnalyticsRow = {
  id: string;
  title: string;
  reads: number;
  likes: number;
  comments: number;
  retention?: string;
  trend?: string;
};

export type StoryPayload = {
  title: string;
  genre: string;
  authorName: string;
  summary?: string;
  body?: string;
  coverUrl?: string | null;
  isDraft?: boolean;
};

export type ChapterPayload = {
  title: string;
  body: string;
  order?: number;
  publishedAt?: string | null;
};

export type MeUser = {
  id: string;
  email?: string;
  username?: string;
  role?: string;
  avatarUrl?: string | null;
  streakCount?: number;
  lastReadDate?: string | null;
  todayReadTime?: number;
  totalReadTime?: number;
  dailyGoalMinutes?: number;
  xp?: number;
  coins?: number;
  isPremium?: boolean;
  readerTheme?: string;
  readerFontSize?: string;
  notificationsOn?: boolean;
};

export type CommentItem = {
  id: string;
  content: string;
  parentId?: string | null;
  createdAt?: string;
  user?: { id?: string; username?: string; avatarUrl?: string | null };
};

export type ActivityItem = {
  id: string;
  type: string;
  userId?: string;
  storyId?: string | null;
  content?: string | null;
  createdAt?: string;
  user?: { id?: string; username?: string; avatarUrl?: string | null };
  story?: {
    id?: string;
    title?: string;
    genre?: string;
    coverUrl?: string | null;
  } | null;
};

export type PublicProfile = {
  id: string;
  username?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  xp?: number;
  streakCount?: number;
  isFollowing?: boolean;
  _count?: { followers?: number; following?: number };
};

function normalizeStoryList(data: unknown): StoryListItem[] {
  if (Array.isArray(data)) return data as StoryListItem[];
  const d = data as { stories?: StoryListItem[]; data?: StoryListItem[] };
  return d.stories || d.data || [];
}

function normalizeComments(data: unknown): CommentItem[] {
  if (Array.isArray(data)) return data as CommentItem[];
  const d = data as { comments?: CommentItem[]; data?: CommentItem[] };
  return d.comments || d.data || [];
}

function normalizeActivities(data: unknown): ActivityItem[] {
  if (Array.isArray(data)) return data as ActivityItem[];
  const d = data as { activities?: ActivityItem[]; data?: ActivityItem[] };
  return d.activities || d.data || [];
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

  me: () => apiFetch<MeUser>("/users/me"),

  userProfile: (userId: string) => apiFetch<PublicProfile>(`/users/${userId}/profile`),

  followUser: (userId: string) =>
    apiFetch(`/users/${userId}/follow`, { method: "POST" }),

  activityFeed: async () => {
    const data = await apiFetch("/activity/feed");
    return normalizeActivities(data);
  },

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

  createStory: (payload: StoryPayload) =>
    apiFetch<StoryDetail>("/stories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateStory: (id: string, payload: Partial<StoryPayload>) =>
    apiFetch<StoryDetail>(`/stories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteStory: (id: string) =>
    apiFetch(`/stories/${id}`, { method: "DELETE" }),

  chapter: (id: string) => apiFetch<Chapter>(`/chapters/${id}`),

  listChapters: async (storyId: string) => {
    const data = await apiFetch<Chapter[] | { chapters?: Chapter[] }>(
      `/stories/${storyId}/chapters`
    );
    if (Array.isArray(data)) return data;
    return (data as { chapters?: Chapter[] }).chapters || [];
  },

  createChapter: (storyId: string, payload: ChapterPayload) =>
    apiFetch<Chapter>(`/stories/${storyId}/chapters`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateChapter: (id: string, payload: Partial<ChapterPayload>) =>
    apiFetch<Chapter>(`/chapters/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteChapter: (id: string) =>
    apiFetch(`/chapters/${id}`, { method: "DELETE" }),

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

  comments: async (storyId: string) => {
    const data = await apiFetch(`/stories/${storyId}/comments`);
    return normalizeComments(data);
  },

  postComment: (storyId: string, body: { content: string; parentId?: string | null }) =>
    apiFetch<CommentItem>(`/stories/${storyId}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  preferences: (body: {
    readerTheme?: string;
    readerFontSize?: string;
    dailyGoalMinutes?: number;
    notificationsOn?: boolean;
  }) =>
    apiFetch("/users/me/preferences", {
      method: "POST",
      body: JSON.stringify(body),
    }).catch(() => null),

  myStories: async () => {
    const data = await apiFetch("/admin/my-stories");
    return normalizeStoryList(data);
  },

  adminStats: () => apiFetch<AdminStats>("/admin/stats"),

  authorAnalytics: async () => {
    const data = await apiFetch<AnalyticsRow[] | { data?: AnalyticsRow[] }>("/admin/analytics");
    if (Array.isArray(data)) return data;
    return (data as { data?: AnalyticsRow[] }).data || [];
  },
};
