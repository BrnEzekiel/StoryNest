"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, hasToken, type CommentItem } from "@/lib/api";

type Props = {
  storyId: string;
  textColor?: string;
  metaColor?: string;
  borderColor?: string;
};

export function StoryComments({ storyId, textColor, metaColor, borderColor }: Props) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.comments(storyId);
      setComments(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onPost(e: React.FormEvent) {
    e.preventDefault();
    if (!hasToken()) {
      setError("Sign in to comment.");
      return;
    }
    if (!text.trim()) return;
    setPosting(true);
    setError("");
    try {
      await api.postComment(storyId, {
        content: text.trim(),
        parentId: replyTo?.id || null,
      });
      setText("");
      setReplyTo(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  const roots = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  function CommentNode({ c, depth = 0 }: { c: CommentItem; depth?: number }) {
    const replies = repliesOf(c.id);
    return (
      <div
        className={depth > 0 ? "ml-4 pl-3 border-l" : ""}
        style={{ borderColor: borderColor || undefined }}
      >
        <div className="py-3">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="font-medium" style={{ color: textColor }}>
              {c.user?.username || "Reader"}
            </span>
            {c.createdAt && (
              <span className="text-xs" style={{ color: metaColor }}>
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: textColor }}>
            {c.content}
          </p>
          {hasToken() && (
            <button
              type="button"
              className="mt-1 text-xs uppercase tracking-wide opacity-70 hover:opacity-100"
              style={{ color: metaColor }}
              onClick={() => {
                setReplyTo(c);
                setText(`@${c.user?.username || ""} `);
              }}
            >
              Reply
            </button>
          )}
        </div>
        {replies.map((r) => (
          <CommentNode key={r.id} c={r} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <section className="mt-14 pt-10 border-t" style={{ borderColor: borderColor }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: textColor }}>
        Discussion
      </h2>

      {loading && (
        <p className="text-sm" style={{ color: metaColor }}>
          Loading comments…
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      {!loading && roots.length === 0 && (
        <p className="text-sm mb-4" style={{ color: metaColor }}>
          No comments yet. Start the conversation.
        </p>
      )}

      <div className="mb-6">
        {roots.map((c) => (
          <CommentNode key={c.id} c={c} />
        ))}
      </div>

      {hasToken() ? (
        <form onSubmit={onPost} className="space-y-3">
          {replyTo && (
            <p className="text-xs" style={{ color: metaColor }}>
              Replying to @{replyTo.user?.username}{" "}
              <button type="button" className="underline" onClick={() => setReplyTo(null)}>
                cancel
              </button>
            </p>
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share a thought…"
            rows={3}
            className="bg-transparent"
            style={{ color: textColor, borderColor: borderColor }}
          />
          <Button type="submit" size="sm" disabled={posting || !text.trim()}>
            {posting ? "Posting…" : "Post comment"}
          </Button>
        </form>
      ) : (
        <p className="text-sm" style={{ color: metaColor }}>
          <Link href="/login" className="underline underline-offset-2">
            Sign in
          </Link>{" "}
          to join the discussion.
        </p>
      )}
    </section>
  );
}
