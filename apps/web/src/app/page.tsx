import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <section className="text-center space-y-6 mb-20">
        <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">
          The nest for imagination
        </p>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-primary leading-tight">
          Stories worth
          <br />
          <span className="border-b-4 border-accent">settling into</span>
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
          Premium long-form reading. Beautiful typography. Streaks that reward
          showing up. A home for writers and readers who care about craft.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/explore" className={cn(buttonVariants({ size: "lg" }))}>
            Explore stories
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
          >
            Create free account
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Read with focus</CardTitle>
            <CardDescription>
              Themes, font size, and progress that sync across devices.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Light, Sepia, and Dark — designed for long sessions, not feeds.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Build streaks</CardTitle>
            <CardDescription>
              Gentle gamification that celebrates consistency.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Show up daily. Your nest remembers.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Write & publish</CardTitle>
            <CardDescription>
              Author tools on web — drafts, covers, scheduled publish.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Coming with the web dashboard migration.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
