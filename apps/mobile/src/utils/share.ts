import { Share, Platform } from "react-native";

/** Native share sheet for stories / profiles */
export async function shareStory(opts: {
  title?: string;
  storyId?: string;
  message?: string;
}) {
  const title = opts.title || "StoryNest";
  const message =
    opts.message ||
    (opts.storyId
      ? `Read “${title}” on StoryNest`
      : `Discover stories on StoryNest`);
  await Share.share(
    Platform.OS === "ios"
      ? { title, message }
      : { title, message }
  );
}
