"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, hasToken, type AnalyticsRow } from "@/lib/api";

export default function AnalyticsPage() {
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
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
        const data = await api.authorAnalytics();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalReads = rows.reduce((a, r) => a + (r.reads || 0), 0);
  const totalLikes = rows.reduce((a, r) => a + (r.likes || 0), 0);

  if (!authed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-primary">Analytics</h1>
        <p className="text-muted-foreground text-sm">Sign in to view author insights.</p>
        <Link href="/login" className={cn(buttonVariants())}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href="/studio"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-4")}
      >
        ← Studio
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight text-primary mb-2">Author insights</h1>
      <p className="text-muted-foreground mb-8 text-sm">Reads, engagement, and retention per story.</p>

      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total reads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">{totalReads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Likes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">{totalLikes}</p>
          </CardContent>
        </Card>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {!loading && rows.length === 0 && !error && (
        <p className="text-muted-foreground text-sm">No analytics yet. Publish a story first.</p>
      )}

      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex justify-between gap-4 mb-4">
              <h2 className="font-medium text-primary">{r.title}</h2>
              {r.trend && (
                <span className="text-xs text-green-700 font-medium">{r.trend}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Reads</p>
                <p className="text-lg font-semibold">{r.reads}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Engagement</p>
                <p className="text-lg font-semibold">{(r.likes || 0) + (r.comments || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Retention</p>
                <p className="text-lg font-semibold">{r.retention || "—"}</p>
              </div>
            </div>
            {r.retention && (
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width:
                      typeof r.retention === "string" && r.retention.includes("%")
                        ? r.retention
                        : "40%",
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
