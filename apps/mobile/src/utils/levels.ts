/**
 * Reader levels: every read earns XP, levels grow quadratically so early
 * progress feels fast and late levels stay prestigious.
 */
export interface LevelInfo {
  level: number;
  name: string;
  progress: number;
  current: number;
  next: number;
}

const LEVEL_NAMES = [
  "Page Turner",
  "Bookworm",
  "Story Seeker",
  "Tale Weaver",
  "Chapter Master",
  "Nest Guardian",
  "Legend",
];

const xpForLevel = (level: number): number => 50 * level * (level - 1);

export const levelForXp = (xp: number): LevelInfo => {
  const safe = Math.max(0, xp || 0);
  let level = 1;
  while (safe >= xpForLevel(level + 1)) level += 1;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const progress = next > current ? Math.min(1, (safe - current) / (next - current)) : 1;
  const name = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
  return { level, name, progress, current, next };
};
