"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, hasToken, type AdminStats, type StoryListItem } from "@/lib/api";
import { StoryCardSkeleton } from "@/components/skeleton";

export default function StudioPage() {
  const [stories, setStories] = useState<StoryListItem[]>([]);
  const [stats, setStats] = useState<AdminStats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        api.myStories(),
        api.adminStats().catch(() => ({})),
      ]);
      setStories(list);
      setStats(st);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load studio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ok = hasToken();
    setAuthed(ok);
    if (!ok) {
      setLoading(false);
      return;
    }
    load();
  }, [load]);

  async function onDelete(id: string) {
    if (!confirm("Delete this story permanently?")) return;
    try {
      await api.deleteStory(id);
      setStories((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-primary">Creator Studio</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to manage stories, chapters, and analytics.
        </p>
        <Link href="/login" className={cn(buttonVariants())}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">Creator Studio</h1>
          <p className="mt-2 text-muted-foreground">Draft, publish, and tend your nest of stories.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/studio/analytics" className={cn(buttonVariants({ variant: "outline" }))}>
            Analytics
          </Link>
          <Link href="/studio/new" className={cn(buttonVariants())}>
            New story
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">{stats.storyCount ?? stories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">{stats.totalReads ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">{stats.userCount ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <StoryCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && stories.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
          <p className="text-muted-foreground text-sm">No stories yet. Publish your first.</p>
          <Link href="/studio/new" className={cn(buttonVariants())}>
            Create story
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {stories.map((s) => (
          <li
            key={s.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-primary truncate">{s.title || "Untitled"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {s.genre || "—"}
                {s.isDraft ? " · Draft" : " · Live"}
                {s.isFlagged ? " · Flagged" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/studio/${s.id}/chapters`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Chapters
              </Link>
              <Link
                href={`/studio/${s.id}/edit`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Edit
              </Link>
              <Link
                href={`/stories/${s.id}`}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                View
              </Link>
              <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(s.id)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
