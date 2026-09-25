"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, hasToken, type BookmarkItem, type StoryListItem } from "@/lib/api";
import { StoryCard } from "@/components/story-card";
import { StoryCardSkeleton } from "@/components/skeleton";

export default function LibraryPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const token = hasToken();
    setAuthed(token);
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await api.myBookmarks();
        if (!cancelled) setBookmarks(list);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load library");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!authed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-primary">Your library</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to see bookmarks and continue reading where you left off.
        </p>
        <Link href="/login" className={cn(buttonVariants())}>
          Sign in
        </Link>
      </div>
    );
  }

  const stories: StoryListItem[] = bookmarks
    .map((b) => {
      if (b.story) return { ...b.story, id: b.story.id || b.storyId };
      return { id: b.storyId, title: "Saved story" };
    })
    .filter((s) => s.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">Library</h1>
        <p className="mt-2 text-muted-foreground">
          Bookmarks and stories you&apos;re mid-flight.
        </p>
      </div>

      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <StoryCardSkeleton key={i} />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {!loading && !error && stories.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
          <p className="text-muted-foreground text-sm">No bookmarks yet.</p>
          <Link href="/explore" className={cn(buttonVariants({ variant: "outline" }))}>
            Explore stories
          </Link>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((s) => {
          const bm = bookmarks.find((b) => b.storyId === s.id);
          return (
            <div key={s.id} className="relative">
              <StoryCard story={s} />
              {typeof bm?.progress === "number" && bm.progress > 0 && (
                <p className="mt-2 text-xs text-muted-foreground px-1">
                  Progress: {bm.progress}%
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
