"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, hasToken, type ActivityItem } from "@/lib/api";

function activityLabel(a: ActivityItem): string {
  const name = a.user?.username || "Someone";
  const title = a.story?.title ? `“${a.story.title}”` : "a story";
  switch (a.type) {
    case "READ":
      return `${name} finished reading ${title}`;
    case "LIKE":
      return `${name} liked ${title}`;
    case "COMMENT":
      return `${name} commented on ${title}`;
    case "ACHIEVEMENT":
      return `${name} earned a new badge`;
    case "PUBLISH":
      return `${name} published ${title}`;
    case "REVIEW":
      return `${name} reviewed ${title}`;
    case "MENTION":
      return `${name} mentioned you`;
    default:
      return `${name} was active in the nest`;
  }
}

function typeBadge(type: string) {
  const map: Record<string, string> = {
    READ: "Read",
    LIKE: "Like",
    COMMENT: "Comment",
    ACHIEVEMENT: "Badge",
    PUBLISH: "Publish",
    REVIEW: "Review",
    MENTION: "Mention",
  };
  return map[type] || type;
}

export default function FeedPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.activityFeed();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
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

  if (!authed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-primary">Activity feed</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to see what authors you follow are reading and publishing.
        </p>
        <Link href="/login" className={cn(buttonVariants())}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">Activity</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Reads, likes, comments, and new releases from your nest.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading feed…</p>}
      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
          <p className="text-muted-foreground text-sm">
            Your feed is quiet. Follow authors from their profile pages.
          </p>
          <Link href="/explore" className={cn(buttonVariants())}>
            Explore stories
          </Link>
        </div>
      )}

      <ul className="space-y-4">
        {items.map((a) => (
          <li key={a.id}>
            <Card>
              <CardContent className="p-4 flex gap-4">
                <div className="h-11 w-11 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary overflow-hidden">
                  {a.user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (a.user?.username || "?")[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {typeBadge(a.type)}
                    </span>
                    {a.createdAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">
                    {a.userId ? (
                      <>
                        <Link
                          href={`/users/${a.userId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {a.user?.username || "Someone"}
                        </Link>
                        {" "}
                        {activityLabel(a).replace(a.user?.username || "Someone", "").trim()}
                      </>
                    ) : (
                      activityLabel(a)
                    )}
                  </p>
                  {a.story && (a.story.id || a.storyId) && (
                    <Link
                      href={`/stories/${a.story.id || a.storyId}`}
                      className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2 hover:bg-muted/70 transition-colors"
                    >
                      {a.story.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.story.coverUrl}
                          alt=""
                          className="h-12 w-9 object-cover rounded"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.story.title}</p>
                        {a.story.genre && (
                          <p className="text-xs text-muted-foreground">{a.story.genre}</p>
                        )}
                      </div>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
