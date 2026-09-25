"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api, hasToken, type MeUser } from "@/lib/api";

function formatMinutes(m?: number) {
  if (m == null) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

export default function StreaksPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState(false);
  const [goal, setGoal] = useState(30);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

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
        setGoal(me.dailyGoalMinutes ?? 30);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg("");
    try {
      await api.preferences({ dailyGoalMinutes: goal });
      setUser((u) => (u ? { ...u, dailyGoalMinutes: goal } : u));
      setSavedMsg("Goal updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save goal");
    } finally {
      setSaving(false);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-primary">Reading streaks</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to track streaks, XP, and daily goals.
        </p>
        <Link href="/login" className={cn(buttonVariants())}>
          Sign in
        </Link>
      </div>
    );
  }

  const today = user?.todayReadTime ?? 0;
  const dailyGoal = user?.dailyGoalMinutes ?? goal;
  const pct = dailyGoal > 0 ? Math.min(100, Math.round((today / dailyGoal) * 100)) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">Streaks & goals</h1>
        <p className="mt-2 text-muted-foreground">
          Keep the nest warm — a little reading every day.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {!loading && user && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Streak</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-primary">
                  {user.streakCount ?? 0}
                  <span className="text-base font-normal text-muted-foreground ml-1">days</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">XP</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-primary">{user.xp ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Lifetime time</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-primary">
                  {formatMinutes(user.totalReadTime)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Today&apos;s goal</CardTitle>
              <CardDescription>
                {formatMinutes(today)} of {formatMinutes(dailyGoal)} · {pct}%
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <form onSubmit={saveGoal} className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="goal">
                    Daily goal (minutes)
                  </label>
                  <Input
                    id="goal"
                    type="number"
                    min={5}
                    max={240}
                    value={goal}
                    onChange={(e) => setGoal(Number(e.target.value) || 30)}
                    className="w-28"
                  />
                </div>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Saving…" : "Save goal"}
                </Button>
                {savedMsg && (
                  <span className="text-sm text-primary">{savedMsg}</span>
                )}
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Link href="/explore" className={cn(buttonVariants())}>
              Continue reading
            </Link>
            <Link href="/library" className={cn(buttonVariants({ variant: "outline" }))}>
              Library
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
