/**
 * Post card (P3a) — mirrors web post-card. Author header (avatar / name /
 * relative time / visibility icon), tagged-pet chips, photo grid (1 / 2 / 2+),
 * emoji reactions, a comment badge that lazy-mounts the comment section, and an
 * author-only delete (confirm). Photo tap opens the lightbox via `onOpenPhotos`
 * — wired in P3b; until then photos render non-interactively.
 */
import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { Post, Visibility } from "@mango/shared-types";

import { deletePost } from "@/lib/posts";
import { relativeTime } from "@/lib/format";
import { colors, radius, shadows, spacing } from "@/theme/theme";
import { UserAvatar } from "./user-avatar";
import { EmojiReactions } from "./emoji-reactions";
import { CommentSection } from "./comment-section";

const VISIBILITY_ICON: Record<Visibility, string> = {
  public: "🌍",
  friends: "👥",
  private: "🔒",
};

export function PostCard({
  post,
  currentUid,
  petNameById,
  onOpenPhotos,
  onDeleted,
}: {
  post: Post;
  currentUid: string;
  petNameById?: Record<string, string>;
  onOpenPhotos?: (urls: string[], index: number) => void;
  onDeleted?: () => void;
}) {
  const { width } = useWindowDimensions();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const [deleting, setDeleting] = useState(false);

  const isAuthor = post.authorUid === currentUid;
  const photos = post.photoURLs ?? [];
  // Card inner content width ≈ screen - horizontal page padding (16) - card pad (16) ×2
  const contentW = Math.max(0, width - spacing.lg * 2 - spacing.lg * 2);
  const taggedNames = petNameById
    ? post.petIds.map((id) => petNameById[id]).filter(Boolean)
    : [];

  function confirmDelete() {
    Alert.alert("刪除貼文", "確定要刪除這篇貼文嗎？此動作無法復原。", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deletePost(post.postId);
            onDeleted?.();
          } catch {
            setDeleting(false);
            Alert.alert("刪除失敗", "請稍後再試。");
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.card, deleting && styles.deleting]}>
      <View style={styles.header}>
        <UserAvatar name={post.authorName} photoURL={post.authorPhotoURL} size={40} />
        <View style={styles.headerText}>
          <Text style={styles.authorName} numberOfLines={1}>
            {post.authorName}
          </Text>
          <Text style={styles.meta}>
            {relativeTime(post.createdAt)} · {VISIBILITY_ICON[post.visibility]}
          </Text>
        </View>
        {isAuthor ? (
          <Pressable
            accessibilityLabel="刪除貼文"
            onPress={confirmDelete}
            hitSlop={8}
            style={styles.menuBtn}
          >
            <Text style={styles.menuText}>⋯</Text>
          </Pressable>
        ) : null}
      </View>

      {post.text ? <Text style={styles.body}>{post.text}</Text> : null}

      {taggedNames.length > 0 ? (
        <View style={styles.tagRow}>
          {taggedNames.map((n, i) => (
            <View key={`${n}-${i}`} style={styles.tag}>
              <Text style={styles.tagText}>🐾 {n}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {photos.length > 0 ? (
        <PhotoGrid
          photos={photos}
          contentW={contentW}
          onOpenPhotos={onOpenPhotos}
        />
      ) : null}

      <View style={styles.actions}>
        <EmojiReactions
          postId={post.postId}
          uid={currentUid}
          initialCounts={post.reactionCounts}
        />
        {/* Comment toggle — 💬 icon only (web is a MessageCircle icon, no
            「留言」label); the count shows only when there are comments. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="留言"
          onPress={() => setCommentsOpen((v) => !v)}
          style={({ pressed }) => [styles.commentBtn, pressed && styles.pressed]}
        >
          <Text style={styles.commentIcon}>💬</Text>
          {commentCount > 0 ? (
            <Text style={styles.commentCount}>{commentCount}</Text>
          ) : null}
        </Pressable>
      </View>

      {commentsOpen ? (
        <CommentSection
          postId={post.postId}
          postAuthorUid={post.authorUid}
          onCountChange={(d) => setCommentCount((c) => Math.max(0, c + d))}
        />
      ) : null}
    </View>
  );
}

function PhotoGrid({
  photos,
  contentW,
  onOpenPhotos,
}: {
  photos: string[];
  contentW: number;
  onOpenPhotos?: (urls: string[], index: number) => void;
}) {
  const single = photos.length === 1;
  const gap = spacing.sm; // web photo grid gap-2
  const cellW = single ? contentW : Math.floor((contentW - gap) / 2);
  const cellH = cellW; // web cells are all aspect-square

  return (
    <View style={[styles.grid, { gap }]}>
      {photos.map((uri, i) => {
        const cell = (
          <Image
            source={{ uri }}
            style={{
              width: cellW,
              height: cellH,
              borderRadius: radius.md,
              backgroundColor: colors.bgAlt,
            }}
          />
        );
        if (!onOpenPhotos) {
          return (
            <View key={`${uri}-${i}`} style={{ width: cellW, height: cellH }}>
              {cell}
            </View>
          );
        }
        return (
          <Pressable
            key={`${uri}-${i}`}
            accessibilityRole="imagebutton"
            accessibilityLabel={`照片 ${i + 1}`}
            onPress={() => onOpenPhotos(photos, i)}
            style={{ width: cellW, height: cellH }}
          >
            {cell}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    // web post-card uses Tailwind rounded-lg (8px) + shadow-sm, not the mango vars.
    borderRadius: radius.sm,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    gap: spacing.md,
    ...shadows.card,
  },
  deleting: { opacity: 0.5 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerText: { flex: 1 },
  authorName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 12, color: colors.ink3, marginTop: 1 },
  menuBtn: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
  menuText: { fontSize: 20, color: colors.ink3, fontWeight: "800" },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.leafTint,
  },
  tagText: { fontSize: 12, fontWeight: "700", color: "#3f7a39" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  commentBtn: {
    flexDirection: "row",
    minHeight: 44,
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  commentIcon: { fontSize: 16 },
  commentCount: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  pressed: { opacity: 0.7 },
});
