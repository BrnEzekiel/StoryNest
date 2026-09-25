"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type StoryItem = {
  id: string;
  title?: string;
  description?: string;
  synopsis?: string;
  coverUrl?: string;
  coverImage?: string;
  author?: { username?: string; name?: string };
};

export default function ExplorePage() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.stories({ limit: 24 });
        const list = Array.isArray(data)
          ? data
          : (data as { stories?: StoryItem[] }).stories ||
            (data as { data?: StoryItem[] }).data ||
            [];
        if (!cancelled) setStories(list as StoryItem[]);
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">Explore</h1>
        <p className="mt-2 text-muted-foreground">Discover stories waiting in the nest.</p>
      </div>

      {loading && (
        <p className="text-muted-foreground text-sm">Loading stories…</p>
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

      {!loading && !error && stories.length === 0 && (
        <p className="text-muted-foreground">No stories yet. Check back soon.</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((s) => (
          <Link key={s.id} href={`/stories/${s.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-lg line-clamp-2">{s.title || "Untitled"}</CardTitle>
                <CardDescription className="line-clamp-1">
                  {s.author?.username || s.author?.name || "Author"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {s.description || s.synopsis || "Open to read."}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
