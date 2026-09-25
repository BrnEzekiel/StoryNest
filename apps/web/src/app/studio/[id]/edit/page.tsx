"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, hasToken } from "@/lib/api";
import { ReaderSkeleton } from "@/components/skeleton";
import { CoverUpload } from "@/components/cover-upload";

const GENRES = ["Fiction", "Romance", "Thriller", "Faith", "Mystery", "Poetry", "Sci-Fi"];

export default function EditStoryPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Fiction");
  const [authorName, setAuthorName] = useState("");
  const [summary, setSummary] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id || !hasToken()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await api.story(id);
        if (cancelled) return;
        setTitle(s.title || "");
        setGenre(s.genre || "Fiction");
        setAuthorName(s.authorName || "");
        setSummary(s.summary || s.description || "");
        setCoverUrl(s.coverUrl || "");
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.updateStory(id, {
        title: title.trim(),
        genre,
        authorName: authorName.trim(),
        summary: summary.trim(),
        coverUrl: coverUrl.trim() || null,
      });
      router.push("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ReaderSkeleton />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/studio" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6 -ml-2")}>
        ← Studio
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit story</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="title">
                Title
              </label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="author">
                Author name
              </label>
              <Input
                id="author"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="genre">
                Genre
              </label>
              <select
                id="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="summary">
                Summary
              </label>
              <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cover</label>
              <CoverUpload value={coverUrl} onChange={setCoverUrl} />
            </div>
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Link
                href={`/studio/${id}/chapters`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Manage chapters
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
