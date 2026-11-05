/** Account roles: readers enjoy, writers and admins create. */
export type AccountRole = "READER" | "WRITER" | "ADMIN";

/** True when the role may create stories, chapters, and podcasts. */
export const canCreateContent = (role?: string | null): boolean =>
  role === "WRITER" || role === "ADMIN";

/** Display name for a role. Unknown roles read as readers. */
export const roleLabel = (role?: string | null): string => {
  if (role === "ADMIN") return "PRO AUTHOR";
  if (role === "WRITER") return "NEST WRITER";
  return "NEST READER";
};

/**
 * Normalize a signup role choice. Only ever yields READER or WRITER:
 * ADMIN can never be self-selected.
 */
export const normalizeAccountType = (input?: string | null): "READER" | "WRITER" =>
  typeof input === "string" && input.toLowerCase() === "writer" ? "WRITER" : "READER";
