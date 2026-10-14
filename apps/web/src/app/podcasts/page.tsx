"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COMING = [
  {
    title: "Nest Night Readings",
    blurb: "Authors read new chapters live — audio drops weekly.",
  },
  {
    title: "Faith & Fiction",
    blurb: "Long-form conversations on stories that form the soul.",
  },
  {
    title: "Behind the Chapter",
    blurb: "Short craft talks from StoryNest writers.",
  },
];

export default function PodcastsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-primary/70 mb-2">Phase C</p>
      <h1 className="text-3xl font-semibold tracking-tight text-primary mb-2">Podcasts</h1>
      <p className="text-muted-foreground text-sm mb-10 max-w-lg">
        Audio stories and author talks are part of the StoryNest social reader. The hub is live;
        episode playback and CMS land next. Meanwhile, keep reading long-form in Explore.
      </p>

      <div className="space-y-4 mb-10">
        {COMING.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{c.title}</CardTitle>
              <CardDescription>{c.blurb}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-[10px] uppercase tracking-wider bg-muted px-2 py-1 rounded text-muted-foreground">
                Coming soon
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Link href="/explore" className={cn(buttonVariants())}>
        Go to Read / Explore
      </Link>
    </div>
  );
}
