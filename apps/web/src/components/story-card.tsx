import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoryListItem } from "@/lib/api";

export function StoryCard({ story }: { story: StoryListItem }) {
  const cover = story.coverUrl || story.coverImage;
  const author =
    story.authorName || story.author?.username || story.author?.name || "Author";
  const blurb =
    story.summary || story.description || story.synopsis || "Open to read.";

  return (
    <Link href={`/stories/${story.id}`} className="block h-full">
      <Card className="h-full transition-shadow hover:shadow-md overflow-hidden">
        {cover && (
          <div className="aspect-[16/9] bg-muted overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <CardHeader className="pb-2">
          {story.genre && (
            <p className="text-xs uppercase tracking-wider text-primary/70 mb-1">
              {story.genre}
            </p>
          )}
          <CardTitle className="text-lg line-clamp-2">{story.title || "Untitled"}</CardTitle>
          <CardDescription className="line-clamp-1">{author}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-3">{blurb}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
