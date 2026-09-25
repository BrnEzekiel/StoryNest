import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-[0.2em] text-primary border-b-2 border-accent pb-0.5">
            STORYNEST
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/explore" className="text-muted-foreground hover:text-foreground transition-colors">
            Explore
          </Link>
          <Link href="/library" className="text-muted-foreground hover:text-foreground transition-colors">
            Library
          </Link>
          <Link href="/streaks" className="text-muted-foreground hover:text-foreground transition-colors">
            Streaks
          </Link>
          <Link href="/studio" className="text-muted-foreground hover:text-foreground transition-colors">
            Studio
          </Link>
          <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
            Admin
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Log in
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
            Join the Nest
          </Link>
        </div>
      </div>
    </header>
  );
}
