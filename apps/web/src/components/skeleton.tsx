import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/80", className)}
      aria-hidden
    />
  );
}

export function StoryCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-4/5" />
      <Skeleton className="h-4 w-40" />
      <div className="space-y-3 pt-8">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
