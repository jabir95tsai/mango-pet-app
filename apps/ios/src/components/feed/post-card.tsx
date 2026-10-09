/**
 * Post card — 1:1 with web apps/web/src/components/feed/post-card.tsx:
 *
 *  - header: avatar 40 · name (14/600) · lucide visibility icon (Globe /
 *    Users / Lock, 12) + localized relative time (12, ink3) · author-only
 *    Trash2 delete (confirm: title Common.delete, message = first 80 chars) or
 *    the ⋯ report/block menu (hidden for guests)
 *  - text (14, relaxed leading, pre-wrap)
 *  - photo grid: 1 → full width, 2+ → 2 columns, square cells, the whole grid
 *    clipped as one 8pt-rounded block; tap opens the lightbox (`onOpenPhotos`)
 *  - actions: reactions + comment pill (36pt, bgAlt, MessageCircle 16 + count)
 *    in a left-aligned wrap row; the pill lazy-mounts CommentSection
 *  - guests (anonymous) get GuestLockedNotice("reactions") in place of the
 *    reactions / comments row, like web — they can still read the post
 *
 * Memoised: in the feed FlatList the card only re-renders when its post (or a
 * handler) changes. Tagged-pet chips were dropped for web parity (FEED-23);
 * `petNameById` is still accepted so existing callers compile.
 */
import { memo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { Globe, Lock, MessageCircle, Trash2, Users, type LucideIcon } from "lucide-react-native";
import type { Post, Visibility } from "@mango/shared-types";

import { GuestLockedNotice } from "@/components/auth/guest-upgrade";
import { deletePost } from "@/lib/posts";
import { relativeTime } from "@/lib/format";
import { alertError, confirm } from "@/lib/confirm";
import { t } from "@/lib/i18n";
import { useAuth } from "@/state/auth-context";
import { colors, radius, shadows, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";
import { UserAvatar } from "./user-avatar";
import { EmojiReactions } from "./emoji-reactions";
import { CommentSection } from "./comment-section";
import { PostMenu } from "./post-menu";

const VISIBILITY_ICON: Record<Visibility, LucideIcon> = {
  public: Globe,
  friends: Users,
  private: Lock,
};

/** Page gutter each feed column uses (Screen / feed list padding). */
const PAGE_PAD = spacing.lg;
/** Card inner padding (web p-4). */
const CARD_PAD = spacing.lg;
/** Card border (web `border`, 1px each side). */
const CARD_BORDER = 1;

export type PostCardProps = {
  post: Post;
  currentUid: string;
  /** @deprecated Tagged-pet chips were removed for web parity; ignored. */
  petNameById?: Record<string, string>;
  onOpenPhotos?: (urls: string[], index: number) => void;
  /** Called after the post was deleted (receives its postId). */
  onDeleted?: (postId: string) => void;
  /** Bubbles up so the feed can drop the blocked author's other posts from
   *  the current view without a full refetch (ugc-moderation.md). */
  onBlocked?: (blockedUid: string) => void;
};

function PostCardImpl({ post, currentUid, onOpenPhotos, onDeleted, onBlocked }: PostCardProps) {
  const { isGuest } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  // Cards render inside a CONTENT_MAX_WIDTH-capped column — on iPad the raw
  // window is much wider than the card, so cap like the screens do.
  const width = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const [deleting, setDeleting] = useState(false);

  const isMine = post.authorUid === currentUid;
  const photos = post.photoURLs ?? [];
  // First-frame estimate only — PhotoGrid measures its real width on layout
  // (an over-estimate would wrap the 2-column grid to one photo per row).
  const contentW = Math.max(0, width - PAGE_PAD * 2 - CARD_PAD * 2 - CARD_BORDER * 2);
  const VIcon = VISIBILITY_ICON[post.visibility] ?? Globe;

  async function handleDelete() {
    if (deleting) return;
    const ok = await confirm({
      title: t("Common.delete"),
      message: post.text ? post.text.slice(0, 80) : t("Feed.deleteConfirm"),
      confirmLabel: t("Common.delete"),
      cancelLabel: t("Common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deletePost(post.postId);
      onDeleted?.(post.postId);
    } catch {
      setDeleting(false);
      alertError(t("Comments.deleteFailed"));
    }
  }

  return (
    <View style={[styles.card, deleting && styles.deleting]}>
      <View style={styles.header}>
        <UserAvatar name={post.authorName} photoURL={post.authorPhotoURL} size={40} />
        <View style={styles.headerText}>
          <Text style={styles.authorName} numberOfLines={1}>
            {post.authorName}
          </Text>
          <View style={styles.metaRow}>
            <VIcon size={12} color={colors.ink3} strokeWidth={2} />
            <Text style={styles.meta}>{relativeTime(post.createdAt)}</Text>
          </View>
        </View>
        {isMine ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Common.delete")}
            onPress={() => void handleDelete()}
            disabled={deleting}
            hitSlop={4}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
          >
            {({ pressed }) => (
              <Trash2 size={16} color={pressed ? colors.danger : colors.ink2} strokeWidth={2} />
            )}
          </Pressable>
        ) : !isGuest ? (
          <PostMenu
            currentUid={currentUid}
            targetType="post"
            postId={post.postId}
            targetId={post.postId}
            targetAuthorUid={post.authorUid}
            targetAuthorName={post.authorName}
            onBlocked={onBlocked}
          />
        ) : null}
      </View>

      {post.text ? <Text style={styles.body}>{post.text}</Text> : null}

      {photos.length > 0 ? (
        <PhotoGrid photos={photos} contentW={contentW} onOpenPhotos={onOpenPhotos} />
      ) : null}

      {/* Reactions + comments need a real identity — guests get the upgrade
          nudge instead (they can still read the post). Spec guest-login §C. */}
      {isGuest ? (
        <GuestLockedNotice feature="reactions" />
      ) : (
        <>
          <View style={styles.actions}>
            <EmojiReactions
              postId={post.postId}
              uid={currentUid}
              initialCounts={post.reactionCounts}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Comments.toggle")}
              accessibilityValue={commentCount > 0 ? { text: String(commentCount) } : undefined}
              accessibilityState={{ expanded: commentsOpen }}
              onPress={() => setCommentsOpen((v) => !v)}
              hitSlop={4}
              style={({ pressed }) => [styles.commentBtn, pressed && styles.commentBtnPressed]}
            >
              <MessageCircle size={16} color={colors.ink2} strokeWidth={2} />
              {commentCount > 0 ? (
                <Text style={styles.commentCount}>{commentCount}</Text>
              ) : null}
            </Pressable>
          </View>

          {commentsOpen ? (
            <CommentSection
              postId={post.postId}
              postAuthorUid={post.authorUid}
              currentUid={currentUid}
              onCountChange={(d) => setCommentCount((c) => Math.max(0, c + d))}
              onBlocked={onBlocked}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

export const PostCard = memo(PostCardImpl);

function PhotoGrid({
  photos,
  contentW,
  onOpenPhotos,
}: {
  photos: string[];
  contentW: number;
  onOpenPhotos?: (urls: string[], index: number) => void;
}) {
  // The grid stretches to the card's content box; measure it so the cells
  // always fit (iPad column cap, card border, any caller's page padding).
  const [measuredW, setMeasuredW] = useState(0);
  const gridW = measuredW > 0 ? measuredW : contentW;
  const single = photos.length === 1;
  const gap = spacing.sm; // web grid gap-2
  const cell = single ? gridW : Math.max(0, Math.floor((gridW - gap) / 2)); // aspect-square

  function onLayout(e: LayoutChangeEvent) {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0 && w !== measuredW) setMeasuredW(w);
  }

  return (
    <View style={[styles.grid, { gap }]} onLayout={onLayout}>
      {photos.map((uri, i) => {
        const img = (
          <Image
            source={{ uri }}
            style={[styles.cellImg, { width: cell, height: cell }]}
            accessibilityIgnoresInvertColors
          />
        );
        if (!onOpenPhotos) {
          return (
            <View key={`${uri}-${i}`} style={{ width: cell, height: cell }}>
              {img}
            </View>
          );
        }
        return (
          <Pressable
            key={`${uri}-${i}`}
            accessibilityRole="imagebutton"
            accessibilityLabel={t("PhotoLightbox.counter", { current: i + 1, total: photos.length })}
            onPress={() => onOpenPhotos(photos, i)}
            style={({ pressed }) => [{ width: cell, height: cell }, pressed && styles.cellPressed]}
          >
            {img}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // web flex flex-col gap-3 rounded-lg border border-zinc-200/80 bg-white p-4 shadow-sm
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: CARD_PAD,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: spacing.md,
    ...shadows.card,
  },
  deleting: { opacity: 0.5 },
  // web header flex items-center gap-3
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  authorName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  // web text-xs text-zinc-500 flex items-center gap-1
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  meta: { fontSize: 12, color: colors.ink3 },
  // web rounded-lg p-2 hover:bg-red-50 hover:text-red-600 (Trash2 size-4)
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnPressed: { backgroundColor: colors.peachTint },
  // web text-sm whitespace-pre-wrap leading-relaxed
  body: { fontSize: 14, lineHeight: 23, color: colors.ink },
  // web grid gap-2 overflow-hidden rounded-lg
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  cellImg: { backgroundColor: colors.bgAlt },
  cellPressed: { opacity: 0.9 },
  // web flex flex-wrap items-center gap-2
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  // web inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-sm text-zinc-600
  commentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
  },
  commentBtnPressed: { backgroundColor: colors.hairline },
  // web text-xs font-medium tabular-nums
  commentCount: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.ink2,
    fontVariant: ["tabular-nums"],
  },
});
