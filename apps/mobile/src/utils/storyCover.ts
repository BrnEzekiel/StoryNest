/**
 * Story cover requirement: no more blank placeholder covers.
 * New stories must ship a picked image; edits may keep the existing one.
 */
export const validateStoryCover = (args: {
  isEditing: boolean;
  coverUri: string | null;
  existingCoverUrl: string | null;
}): string | null => {
  if (args.coverUri) return null;
  if (args.isEditing && args.existingCoverUrl) return null;
  return args.isEditing
    ? "This story has no cover yet. Please pick one before saving."
    : "Please choose a cover image for your story before publishing.";
};
