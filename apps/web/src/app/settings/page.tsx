"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, hasToken, type MeUser } from "@/lib/api";

export default function SettingsPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [authed, setAuthed] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [saving, setSaving] = useState(false);

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
        const me = await api.me();
        if (cancelled) return;
        setUser(me);
        setNotificationsOn(me.notificationsOn !== false);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveNotifications(next: boolean) {
    setNotificationsOn(next);
    setSaving(true);
    setMsg("");
    setError("");
    try {
      await api.preferences({ notificationsOn: next });
      setUser((u) => (u ? { ...u, notificationsOn: next } : u));
      setMsg(next ? "Email digests enabled." : "Email digests disabled.");
    } catch (err) {
      setNotificationsOn(!next);
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-primary">Settings</h1>
        <p className="text-muted-foreground text-sm">Sign in to manage notification preferences.</p>
        <Link href="/login" className={cn(buttonVariants())}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-primary mb-2">Settings</h1>
      <p className="text-muted-foreground text-sm mb-8">
        {user?.username ? `Signed in as ${user.username}` : "Account preferences"}
      </p>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {msg && (
        <p className="mb-4 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
          {msg}
        </p>
      )}

      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle>Email digests</CardTitle>
            <CardDescription>
              Weekly nest digest of new stories (Sunday ~09:00 UTC). Requires the worker process and
              Gmail config.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span className="text-sm font-medium">Receive weekly digest</span>
              <button
                type="button"
                role="switch"
                aria-checked={notificationsOn}
                disabled={saving}
                onClick={() => saveNotifications(!notificationsOn)}
                className={cn(
                  "relative h-7 w-12 rounded-full transition-colors",
                  notificationsOn ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                    notificationsOn && "translate-x-5"
                  )}
                />
              </button>
            </label>
            <p className="text-xs text-muted-foreground">
              You can also adjust daily reading goals on{" "}
              <Link href="/streaks" className="underline underline-offset-2">
                Streaks
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/streaks" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Streaks
        </Link>
        <Link href="/feed" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Feed
        </Link>
      </div>
    </div>
  );
}
