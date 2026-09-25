"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, hasToken, type PublicProfile } from "@/lib/api";

export default function UserProfilePage() {
  const params = useParams();
  const userId = String(params?.id || "");

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await api.userProfile(userId);
        if (cancelled) return;
        setProfile(p);
        setFollowing(Boolean(p.isFollowing));
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
  }, [userId]);

  async function toggleFollow() {
    if (!hasToken()) {
      setError("Sign in to follow authors.");
      return;
    }
    const next = !following;
    setFollowing(next);
    setFollowBusy(true);
    try {
      await api.followUser(userId);
    } catch {
      setFollowing(!next);
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-sm text-muted-foreground">
        Loading profile…
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 space-y-4">
        <p className="text-red-700">{error}</p>
        <Link href="/feed" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to feed
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  const initial = (profile.username || "?")[0]?.toUpperCase();

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <Link
        href="/feed"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-6")}
      >
        ← Feed
      </Link>

      <Card className="overflow-hidden">
        <div className="bg-primary px-6 pt-10 pb-16 text-center text-primary-foreground">
          <div className="mx-auto h-24 w-24 rounded-full border-4 border-accent bg-primary/80 flex items-center justify-center text-3xl font-semibold overflow-hidden">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-accent">{initial}</span>
            )}
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white">{profile.username}</h1>
          <p className="mt-2 text-sm text-pale-green/90 text-white/80 max-w-sm mx-auto">
            {profile.bio || "Searching for the next great story…"}
          </p>
        </div>

        <CardContent className="-mt-8 relative space-y-6">
          <div className="rounded-xl border border-border bg-card shadow-sm grid grid-cols-3 divide-x divide-border">
            <div className="py-4 text-center">
              <p className="text-lg font-semibold text-primary">
                {profile._count?.followers ?? 0}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Followers
              </p>
            </div>
            <div className="py-4 text-center">
              <p className="text-lg font-semibold text-primary">{profile.xp ?? 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">XP</p>
            </div>
            <div className="py-4 text-center">
              <p className="text-lg font-semibold text-primary">
                {profile._count?.following ?? 0}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Following
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              variant={following ? "outline" : "default"}
              disabled={followBusy}
              onClick={toggleFollow}
            >
              {following ? "Following" : "Follow"}
            </Button>
            <Link href="/explore" className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>
              Explore
            </Link>
          </div>

          {typeof profile.streakCount === "number" && profile.streakCount > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              🔥 {profile.streakCount}-day reading streak
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
