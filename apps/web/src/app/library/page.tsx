import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 text-center space-y-4">
      <h1 className="text-3xl font-semibold text-primary">Library</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        Bookmarks, continue reading, and history will live here once you are signed in.
      </p>
      <Button asChild>
        <Link href="/login">Sign in to open your library</Link>
      </Button>
    </div>
  );
}
