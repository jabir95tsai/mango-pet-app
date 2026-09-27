// UGC moderation filtering — pure, cross-platform. Spec
// docs/features/ugc-moderation.md. Both apps/web and apps/ios call this to
// keep report/block behavior identical: hidden content and blocked authors
// disappear from every list render, client-side.

/** True if `authorUid` is on the viewer's own block list. */
export function isAuthorBlocked(
  authorUid: string,
  viewerBlockedUids: readonly string[] | null | undefined,
): boolean {
  return !!viewerBlockedUids?.includes(authorUid);
}

/** Should this piece of content (post or comment) render for the viewer?
 *  False if it's been auto-hidden (reportCount hit threshold) OR its
 *  author is on the viewer's block list. Hidden applies to everyone,
 *  including the author — v1 keeps this simple rather than building an
 *  "your post is under review" state (see spec §不做). */
export function isContentVisible(item: {
  authorUid: string;
  hidden?: boolean | null;
}, viewerBlockedUids: readonly string[] | null | undefined): boolean {
  if (item.hidden) return false;
  return !isAuthorBlocked(item.authorUid, viewerBlockedUids);
}

/** Filter a list of posts/comments down to what the viewer should see. */
export function filterVisible<T extends { authorUid: string; hidden?: boolean | null }>(
  items: readonly T[],
  viewerBlockedUids: readonly string[] | null | undefined,
): T[] {
  return items.filter((item) => isContentVisible(item, viewerBlockedUids));
}
