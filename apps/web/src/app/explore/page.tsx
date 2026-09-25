"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { api, type StoryListItem } from "@/lib/api";
import { StoryCard } from "@/components/story-card";
import { StoryCardSkeleton } from "@/components/skeleton";

export default function ExplorePage() {
  const [stories, setStories] = useState<StoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.stories({ limit: 48 });
        if (!cancelled) setStories(list);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load stories");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const genres = useMemo(() => {
    const set = new Set<string>();
    stories.forEach((s) => {
      if (s.genre) set.add(s.genre);
    });
    return Array.from(set).sort();
  }, [stories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stories.filter((s) => {
      if (genre && s.genre !== genre) return false;
      if (!q) return true;
      const hay = [
        s.title,
        s.summary,
        s.description,
        s.synopsis,
        s.authorName,
        s.author?.username,
        s.genre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [stories, query, genre]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-8 space-y-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">Explore</h1>
          <p className="mt-2 text-muted-foreground">Discover stories waiting in the nest.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search title, author, genre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-sm"
          />
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StoryCardSkeleton key={i} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-border bg-card p-6 text-sm">
          <p className="text-red-700 mb-2">{error}</p>
          <p className="text-muted-foreground">
            Make sure the backend is running and{" "}
            <code className="text-xs bg-muted px-1 rounded">NEXT_PUBLIC_API_URL</code> is set
            (default <code className="text-xs bg-muted px-1 rounded">http://localhost:5000</code>).
          </p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-muted-foreground">No stories match your filters.</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
      </div>
    </div>
  );
}
