"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, hasToken, type AdminStats, type StoryListItem } from "@/lib/api";

/**
 * Admin overview — uses the same /admin/* endpoints as mobile Creator Hub.
 * Full user moderation depends on backend routes; this surfaces stats + your catalog.
 */
export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats>({});
  const [stories, setStories] = useState<StoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const ok = hasToken();
    setAuthed(ok);
    if (!ok) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [st, list] = await Promise.all([
          api.adminStats(),
          api.myStories(),
        ]);
        if (!cancelled) {
          setStats(st);
          setStories(list);
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Admin endpoints require an elevated account"
          );
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
        <h1 className="text-2xl font-semibold text-primary">Admin</h1>
        <p className="text-muted-foreground text-sm">Sign in with an admin account.</p>
        <Link href="/login" className={cn(buttonVariants())}>
          Sign in
        </Link>
      </div>
    );
  }

  const flagged = stories.filter((s) => s.isFlagged);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">Admin</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Platform overview. Author tools live in{" "}
            <Link href="/studio" className="underline underline-offset-2">
              Studio
            </Link>
            .
          </p>
        </div>
        <Link href="/studio" className={cn(buttonVariants({ variant: "outline" }))}>
          Open Studio
        </Link>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Stories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{stats.storyCount ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total reads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{stats.totalReads ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{stats.userCount ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-medium text-primary mb-4">Flagged content</h2>
        {flagged.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flagged stories in your catalog.</p>
        ) : (
          <ul className="space-y-2">
            {flagged.map((s) => (
              <li
                key={s.id}
                className="flex justify-between items-center rounded-lg border border-red-200 bg-red-50/50 px-4 py-3"
              >
                <span className="font-medium">{s.title}</span>
                <Link
                  href={`/studio/${s.id}/edit`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-primary mb-4">Your catalog</h2>
        <ul className="space-y-2">
          {stories.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm"
            >
              <span>
                {s.title}{" "}
                <span className="text-muted-foreground">· {s.genre}</span>
              </span>
              <Link href={`/stories/${s.id}`} className="text-primary underline-offset-2 hover:underline">
                Open
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
