"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type StoryDetail = {
  id: string;
  title?: string;
  description?: string;
  synopsis?: string;
  content?: string;
  body?: string;
  chapters?: { id: string; title?: string; content?: string; order?: number }[];
  author?: { username?: string; name?: string };
};

export default function StoryPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.story(id);
        if (!cancelled) setStory(data as StoryDetail);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load story");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <p className="text-red-700">{error || "Story not found"}</p>
        <Button variant="outline" asChild>
          <Link href="/explore">Back to Explore</Link>
        </Button>
      </div>
    );
  }

  const body =
    story.content ||
    story.body ||
    story.chapters
      ?.slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((c) => c.content)
      .filter(Boolean)
      .join("\n\n") ||
    story.description ||
    story.synopsis ||
    "";

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-8 -ml-2" asChild>
        <Link href="/explore">← Explore</Link>
      </Button>
      <header className="mb-10 space-y-3 border-b border-border pb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-primary leading-tight">
          {story.title || "Untitled"}
        </h1>
        <p className="text-sm text-muted-foreground">
          by {story.author?.username || story.author?.name || "Author"}
        </p>
      </header>
      <div className="prose prose-neutral max-w-none font-serif text-lg leading-relaxed whitespace-pre-wrap text-foreground">
        {body || "No content available yet."}
      </div>
    </article>
  );
}
