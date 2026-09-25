"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, hasToken, type Chapter } from "@/lib/api";
import { RichTextEditor } from "@/components/rich-text-editor";

export default function ChaptersPage() {
  const params = useParams();
  const storyId = String(params?.id || "");

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [storyTitle, setStoryTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [isForm, setIsForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!storyId || !hasToken()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [chs, story] = await Promise.all([
        api.listChapters(storyId),
        api.story(storyId).catch(() => null),
      ]);
      setChapters(chs.slice().sort((a, b) => (a.order || 0) - (b.order || 0)));
      if (story?.title) setStoryTitle(story.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chapters");
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setTitle("");
    setBody("");
    setPublishedAt("");
    setIsForm(true);
  }

  function openEdit(c: Chapter) {
    setEditing(c);
    setTitle(c.title || "");
    setBody(c.body || c.content || "");
    setPublishedAt(
      c.publishedAt ? new Date(c.publishedAt).toISOString().slice(0, 16) : ""
    );
    setIsForm(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
        order: editing ? editing.order : chapters.length + 1,
      };
      if (editing) {
        await api.updateChapter(editing.id, payload);
      } else {
        await api.createChapter(storyId, payload);
      }
      setIsForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this chapter?")) return;
    try {
      await api.deleteChapter(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  if (isForm) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <button
          type="button"
          onClick={() => setIsForm(false)}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6 -ml-2")}
        >
          ← Chapters
        </button>
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit chapter" : "New chapter"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="ctitle">
                  Chapter title
                </label>
                <Input
                  id="ctitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="pub">
                  Schedule publish (optional)
                </label>
                <Input
                  id="pub"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Empty = publish now. Future dates stay draft until the content worker scans them.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Body</label>
                  <span className="text-xs text-muted-foreground">{wordCount} words</span>
                </div>
                <RichTextEditor value={body} onChange={setBody} minHeight="min-h-[320px]" />
              </div>
              {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save chapter"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/studio"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-2")}
          >
            ← Studio
          </Link>
          <h1 className="text-2xl font-semibold text-primary">Chapters</h1>
          <p className="text-sm text-muted-foreground">{storyTitle || storyId}</p>
        </div>
        <Button type="button" onClick={openNew}>
          New chapter
        </Button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && chapters.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
          <p className="text-muted-foreground text-sm">No chapters yet.</p>
          <Button type="button" onClick={openNew}>
            Create chapter 1
          </Button>
        </div>
      )}

      <ul className="space-y-2">
        {chapters.map((c, idx) => {
          const scheduled = c.publishedAt && new Date(c.publishedAt) > new Date();
          return (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <span className="text-2xl font-semibold text-primary/30 w-8">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.title || `Chapter ${idx + 1}`}</p>
                <p className="text-xs text-muted-foreground">
                  {scheduled && (
                    <span className="text-primary">
                      Scheduled {new Date(c.publishedAt!).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => openEdit(c)}>
                Edit
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(c.id)}>
                Delete
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
