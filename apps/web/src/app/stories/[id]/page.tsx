"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  api,
  hasToken,
  type Chapter,
  type StoryDetail,
} from "@/lib/api";
import { ReaderSkeleton } from "@/components/skeleton";

type ReaderTheme = "light" | "sepia" | "dark";
type FontSize = "small" | "medium" | "large";

const THEMES: Record<
  ReaderTheme,
  { bg: string; text: string; meta: string; bar: string; border: string }
> = {
  light: {
    bg: "#fdfaf5",
    text: "#003631",
    meta: "#5a7a76",
    bar: "#003631",
    border: "#e8e0d5",
  },
  sepia: {
    bg: "#f4ecd8",
    text: "#433422",
    meta: "#5f4b32",
    bar: "#5f4b32",
    border: "#e0d4bc",
  },
  dark: {
    bg: "#121212",
    text: "#f0ebe3",
    meta: "#7db8b2",
    bar: "#FFEDA8",
    border: "#2a2a2a",
  },
};

const FONT_PX: Record<FontSize, number> = {
  small: 16,
  medium: 18,
  large: 22,
};

export default function StoryPage() {
  const params = useParams();
  const id = String(params?.id || "");

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<ReaderTheme>("light");
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const [progress, setProgress] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = THEMES[theme];
  const fontPx = FONT_PX[fontSize];

  const loadChapter = useCallback(async (chapter: Chapter) => {
    if (chapter.body || chapter.content) {
      setCurrentChapter(chapter);
      return;
    }
    try {
      const full = await api.chapter(chapter.id);
      setCurrentChapter({ ...chapter, ...full });
    } catch {
      setCurrentChapter(chapter);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.story(id);
        if (cancelled) return;
        setStory(data);
        const chs = (data.chapters || [])
          .slice()
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setChapters(chs);
        if (chs.length > 0) {
          await loadChapter(chs[0]);
        }
        api.markRead(id);

        if (hasToken()) {
          try {
            const bms = await api.myBookmarks();
            const bm = bms.find((b) => b.storyId === id);
            setBookmarked(!!bm);
            if (bm?.progress) setProgress(bm.progress / 100);
          } catch {
            /* guest or endpoint unavailable */
          }
        }

        const savedTheme = localStorage.getItem("sn_reader_theme") as ReaderTheme | null;
        const savedFont = localStorage.getItem("sn_reader_font") as FontSize | null;
        if (savedTheme && THEMES[savedTheme]) setTheme(savedTheme);
        if (savedFont && FONT_PX[savedFont]) setFontSize(savedFont);
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
  }, [id, loadChapter]);

  const bodyText = useMemo(() => {
    const raw =
      currentChapter?.body ||
      currentChapter?.content ||
      story?.body ||
      story?.content ||
      "";
    return raw.replace(/\r\n/g, "\n");
  }, [currentChapter, story]);

  const paragraphs = useMemo(
    () =>
      bodyText
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean),
    [bodyText]
  );

  const chapterIdx = chapters.findIndex((c) => c.id === currentChapter?.id);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const p = max > 0 ? el.scrollTop / max : 0;
    setProgress(p);

    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => {
      if (!bookmarked || !hasToken()) return;
      api.bookmark(id, Math.round(p * 100)).catch(() => {});
    }, 1500);
  }

  async function toggleBookmark() {
    if (!hasToken()) {
      setError("Sign in to save bookmarks.");
      return;
    }
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await api.bookmark(id, next ? Math.round(progress * 100) : -1);
    } catch {
      setBookmarked(!next);
    }
  }

  function applyTheme(mode: ReaderTheme) {
    setTheme(mode);
    localStorage.setItem("sn_reader_theme", mode);
    if (hasToken()) api.preferences({ readerTheme: mode });
  }

  function applyFont(size: FontSize) {
    setFontSize(size);
    localStorage.setItem("sn_reader_font", size);
    if (hasToken()) api.preferences({ readerFontSize: size });
  }

  if (loading) return <ReaderSkeleton />;

  if (error && !story) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <p className="text-red-700">{error}</p>
        <Link href="/explore" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to Explore
        </Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-4rem)] flex flex-col"
      style={{ backgroundColor: t.bg, color: t.text }}
    >
      {/* Progress bar */}
      <div
        className="sticky top-16 z-40 h-1 w-full"
        style={{ backgroundColor: t.border }}
      >
        <div
          className="h-full transition-[width] duration-200"
          style={{ width: `${progress * 100}%`, backgroundColor: t.bar }}
        />
      </div>

      {/* Toolbar */}
      <div
        className="sticky top-[4.25rem] z-30 border-b px-4 py-2 flex flex-wrap items-center gap-2 justify-between"
        style={{ backgroundColor: t.bg, borderColor: t.border }}
      >
        <Link
          href="/explore"
          className="text-sm opacity-80 hover:opacity-100"
          style={{ color: t.meta }}
        >
          ← Explore
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowToc((v) => !v)}
            className="text-xs uppercase tracking-wide px-2 py-1 rounded border"
            style={{ borderColor: t.border, color: t.meta }}
          >
            Chapters
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="text-xs uppercase tracking-wide px-2 py-1 rounded border"
            style={{ borderColor: t.border, color: t.meta }}
          >
            Display
          </button>
          <button
            type="button"
            onClick={toggleBookmark}
            className="text-xs uppercase tracking-wide px-2 py-1 rounded border"
            style={{
              borderColor: t.border,
              color: bookmarked ? t.bar : t.meta,
              fontWeight: bookmarked ? 600 : 400,
            }}
          >
            {bookmarked ? "Bookmarked" : "Bookmark"}
          </button>
        </div>
      </div>

      {showSettings && (
        <div
          className="border-b px-4 py-4 space-y-4"
          style={{ borderColor: t.border, backgroundColor: t.bg }}
        >
          <div>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: t.meta }}>
              Theme
            </p>
            <div className="flex gap-2 flex-wrap">
              {(["light", "sepia", "dark"] as ReaderTheme[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => applyTheme(mode)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border capitalize",
                    theme === mode && "ring-2 ring-offset-1"
                  )}
                  style={{
                    borderColor: t.border,
                    backgroundColor: THEMES[mode].bg,
                    color: THEMES[mode].text,
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: t.meta }}>
              Font size
            </p>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as FontSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => applyFont(size)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border capitalize",
                    fontSize === size && "font-semibold"
                  )}
                  style={{ borderColor: t.border, color: t.text }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showToc && chapters.length > 0 && (
        <div
          className="border-b px-4 py-3 max-h-48 overflow-y-auto"
          style={{ borderColor: t.border }}
        >
          <ul className="space-y-1">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="text-left w-full text-sm py-1.5 px-2 rounded hover:opacity-80"
                  style={{
                    color: c.id === currentChapter?.id ? t.bar : t.text,
                    fontWeight: c.id === currentChapter?.id ? 600 : 400,
                  }}
                  onClick={() => {
                    loadChapter(c);
                    setShowToc(false);
                    scrollRef.current?.scrollTo({ top: 0 });
                    setProgress(0);
                  }}
                >
                  {c.title || `Chapter ${i + 1}`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 8rem)" }}
      >
        <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <header className="mb-10 space-y-2">
            {story?.genre && (
              <p
                className="text-xs uppercase tracking-[0.2em]"
                style={{ color: t.meta }}
              >
                {story.genre}
              </p>
            )}
            <h1
              className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight"
              style={{ color: t.text }}
            >
              {story?.title || "Untitled"}
            </h1>
            <p className="text-sm" style={{ color: t.meta }}>
              by{" "}
              {story?.authorName ||
                story?.author?.username ||
                story?.author?.name ||
                "Author"}
              {currentChapter?.title
                ? ` · ${currentChapter.title}`
                : chapters.length
                  ? " · Chapter 1"
                  : ""}
            </p>
          </header>

          {story?.canRead === false ? (
            <div className="text-center py-16 space-y-4">
              <p className="text-lg font-medium">Premium story</p>
              <p className="text-sm" style={{ color: t.meta }}>
                Unlock this story on mobile or after signing in with a premium account.
              </p>
              <Link href="/login" className={cn(buttonVariants())}>
                Sign in
              </Link>
            </div>
          ) : paragraphs.length > 0 ? (
            <div className="font-serif">
              {paragraphs.map((para, idx) => (
                <p
                  key={idx}
                  className="mb-5 whitespace-pre-wrap"
                  style={{
                    fontSize: fontPx,
                    lineHeight: 1.75,
                    color: t.text,
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: t.meta }}>
              No content available yet.
            </p>
          )}

          {chapters.length > 1 && (
            <div
              className="mt-12 pt-8 flex justify-between gap-4 border-t"
              style={{ borderColor: t.border }}
            >
              <Button
                type="button"
                variant="outline"
                disabled={chapterIdx <= 0}
                onClick={() => {
                  if (chapterIdx > 0) {
                    loadChapter(chapters[chapterIdx - 1]);
                    scrollRef.current?.scrollTo({ top: 0 });
                    setProgress(0);
                  }
                }}
              >
                ← Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={chapterIdx < 0 || chapterIdx >= chapters.length - 1}
                onClick={() => {
                  if (chapterIdx < chapters.length - 1) {
                    loadChapter(chapters[chapterIdx + 1]);
                    scrollRef.current?.scrollTo({ top: 0 });
                    setProgress(0);
                  }
                }}
              >
                Next →
              </Button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
