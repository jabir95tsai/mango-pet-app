/**
 * Comment section — 1:1 with web apps/web/src/components/feed/comment-section
 * .tsx (feed-comments-and-reactions-v2 §A). Lazy-mounted by PostCard only when
 * the user opens comments (read on demand, no onSnapshot). Loads oldest-first,
 * cursor-paginated (20) with the "load more" control above the list like web.
 *
 *  - row: avatar 32 + rounded bubble (bgAlt) holding the name (12/600) and
 *    text (14); under it an 11pt meta line: relative time · Trash2 + delete
 *    (comment author OR post author) · ⋯ report/block menu (anyone else's
 *    comment — both can show, so a post author can still report a commenter)
 *  - composer: your avatar 32 + rounded input + 36pt round mango Send button
 *  - optimistic append with rollback; destructive confirm before delete,
 *    rollback + Comments.deleteFailed on failure
 * Bubbles count deltas up so PostCard's badge stays in sync without a
 * refetch. commentCount denorm is server-maintained — we never write it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Send, Trash2 } from "lucide-react-native";
import { COMMENT_MAX_LEN, type Comment } from "@mango/shared-types";
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

import { createComment, deleteComment, listComments } from "@/lib/posts";
import { getBlockedUids } from "@/lib/user-prefs";
import { confirm } from "@/lib/confirm";
import { relativeTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useAuth } from "@/state/auth-context";
import { colors, radius, spacing } from "@/theme/theme";
import { UserAvatar } from "./user-avatar";
import { PostMenu } from "./post-menu";

type Cursor = FirebaseFirestoreTypes.QueryDocumentSnapshot | null;

const PAGE_SIZE = 20;
// web rounded-2xl (16px) bubble / input
const BUBBLE_RADIUS = 16;

export function CommentSection({
  postId,
  postAuthorUid,
  currentUid,
  onCountChange,
  onBlocked,
}: {
  postId: string;
  /** Post author — may delete any comment on their own post (rules parity). */
  postAuthorUid: string;
  /** Needed for the per-comment report/block menu (ugc-moderation.md). */
  currentUid: string;
  onCountChange?: (delta: number) => void;
  onBlocked?: (blockedUid: string) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Initial page — reads the viewer's block list once so the first page and
  // loadMore filter consistently (ugc-moderation.md).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const blocked = await getBlockedUids(currentUid).catch(() => [] as string[]);
        if (cancelled) return;
        setBlockedUids(blocked);
        const page = await listComments(postId, PAGE_SIZE, null, blocked);
        if (!cancelled) {
          setComments(page.comments);
          setCursor(page.cursor);
        }
      } catch {
        if (!cancelled) setError(t("Comments.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, currentUid]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listComments(postId, PAGE_SIZE, cursor, blockedUids);
      if (!aliveRef.current) return;
      setComments((prev) => [...prev, ...page.comments]);
      setCursor(page.cursor);
    } catch {
      if (aliveRef.current) setError(t("Comments.loadFailed"));
    } finally {
      if (aliveRef.current) setLoadingMore(false);
    }
  }, [cursor, loadingMore, postId, blockedUids]);

  async function submit() {
    const body = text.trim();
    if (!user || submitting || !body) return;
    if (body.length > COMMENT_MAX_LEN) {
      setError(t("Comments.tooLong", { max: COMMENT_MAX_LEN }));
      return;
    }
    setSubmitting(true);
    setError(null);
    // Optimistic append at the bottom; the temp id is swapped for the real one.
    const tempId = `temp-${postId}-${comments.length}-${Date.now()}`;
    const authorName = user.displayName ?? user.email?.split("@")[0] ?? "Friend";
    const optimistic: Comment = {
      commentId: tempId,
      authorUid: user.uid,
      authorName,
      authorPhotoURL: user.photoURL ?? null,
      text: body,
      // No server timestamp yet; relativeTime() treats a missing value as "now".
      createdAt: undefined as unknown as Comment["createdAt"],
    };
    setComments((prev) => [...prev, optimistic]);
    setText("");
    onCountChange?.(1);
    try {
      const { commentId } = await createComment({
        postId,
        authorUid: user.uid,
        authorName,
        authorPhotoURL: user.photoURL ?? null,
        text: body,
      });
      if (!aliveRef.current) return;
      setComments((prev) =>
        prev.map((c) => (c.commentId === tempId ? { ...c, commentId } : c)),
      );
    } catch {
      if (!aliveRef.current) return;
      // Roll back the row + restore the draft so the user can retry.
      setComments((prev) => prev.filter((c) => c.commentId !== tempId));
      setText(body);
      onCountChange?.(-1);
      setError(t("Comments.sendFailed"));
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  }

  async function handleDelete(c: Comment) {
    if (c.commentId.startsWith("temp-")) return;
    const ok = await confirm({
      title: t("Comments.deleteTitle"),
      message: c.text.slice(0, 60),
      confirmLabel: t("Common.delete"),
      cancelLabel: t("Common.cancel"),
      destructive: true,
    });
    if (!ok || !aliveRef.current) return;
    // Remember where the row was so a failed delete puts it back in place
    // without discarding anything that changed while the confirm was open.
    let index = -1;
    setComments((prev) => {
      index = prev.findIndex((x) => x.commentId === c.commentId);
      return index < 0 ? prev : prev.filter((x) => x.commentId !== c.commentId);
    });
    onCountChange?.(-1);
    setError(null);
    try {
      await deleteComment(postId, c.commentId);
    } catch {
      if (!aliveRef.current) return;
      setComments((prev) => {
        if (prev.some((x) => x.commentId === c.commentId)) return prev;
        const next = [...prev];
        next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, c);
        return next;
      });
      onCountChange?.(1);
      setError(t("Comments.deleteFailed"));
    }
  }

  const canDelete = (c: Comment) =>
    !!user && (c.authorUid === user.uid || postAuthorUid === user.uid);
  const remaining = COMMENT_MAX_LEN - text.length;
  const sendDisabled = !text.trim() || submitting;

  return (
    <View style={styles.wrap}>
      {loading ? (
        <Text style={styles.loading}>{t("Comments.loading")}</Text>
      ) : comments.length === 0 ? (
        <Text style={styles.empty}>{t("Comments.empty")}</Text>
      ) : (
        <>
          {cursor ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
              onPress={() => void loadMore()}
              disabled={loadingMore}
              hitSlop={10}
              style={({ pressed }) => [
                styles.more,
                pressed && styles.morePressed,
                loadingMore && styles.moreDisabled,
              ]}
            >
              <Text style={styles.moreText}>
                {loadingMore ? t("Comments.loading") : t("Comments.loadMore")}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.list}>
            {comments.map((c) => (
              <View key={c.commentId} style={styles.row}>
                <UserAvatar name={c.authorName} photoURL={c.authorPhotoURL} size={32} />
                <View style={styles.rowBody}>
                  <View style={styles.bubble}>
                    <Text style={styles.name} numberOfLines={1}>
                      {c.authorName}
                    </Text>
                    <Text style={styles.text}>{c.text}</Text>
                  </View>
                  <View style={styles.meta}>
                    <Text style={styles.metaText}>{relativeTime(c.createdAt)}</Text>
                    {canDelete(c) ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Comments.deleteTitle")}
                        onPress={() => void handleDelete(c)}
                        hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
                        style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}
                      >
                        <Trash2 size={12} color={colors.ink3} strokeWidth={2} />
                        <Text style={styles.metaText}>{t("Comments.delete")}</Text>
                      </Pressable>
                    ) : null}
                    {c.authorUid !== currentUid ? (
                      <PostMenu
                        currentUid={currentUid}
                        targetType="comment"
                        postId={postId}
                        targetId={c.commentId}
                        targetAuthorUid={c.authorUid}
                        targetAuthorName={c.authorName}
                        onBlocked={onBlocked}
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Composer — bottom-anchored, optimistic append. */}
      {user ? (
        <View style={styles.composer}>
          <UserAvatar name={user.displayName ?? ""} photoURL={user.photoURL} size={32} />
          <TextInput
            style={[styles.input, focused && styles.inputFocused]}
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t("Comments.placeholder")}
            accessibilityLabel={t("Comments.placeholder")}
            placeholderTextColor={colors.ink3}
            selectionColor={colors.brandDeep}
            multiline
            maxLength={COMMENT_MAX_LEN}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Comments.send")}
            accessibilityState={{ disabled: sendDisabled, busy: submitting }}
            onPress={() => void submit()}
            disabled={sendDisabled}
            hitSlop={4}
            style={({ pressed }) => [
              styles.send,
              sendDisabled && styles.sendDisabled,
              pressed && !sendDisabled && styles.sendPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Send size={16} color="#ffffff" strokeWidth={2} />
            )}
          </Pressable>
        </View>
      ) : null}
      {text.length > COMMENT_MAX_LEN - 50 ? (
        <Text style={styles.remaining}>{remaining}</Text>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // web mt-1 flex flex-col gap-3 border-t border-zinc-100 pt-3
  wrap: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    gap: spacing.md,
  },
  // web px-1 text-sm text-zinc-500
  loading: { paddingHorizontal: 4, fontSize: 14, color: colors.ink3 },
  // web px-1 py-2 text-center text-sm text-zinc-500
  empty: { paddingHorizontal: 4, paddingVertical: spacing.sm, textAlign: "center", fontSize: 14, color: colors.ink3 },
  // web self-start rounded-full px-2 py-1 text-xs font-semibold text-mango-brand-deep
  more: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  morePressed: { backgroundColor: colors.brandTint },
  moreDisabled: { opacity: 0.6 },
  moreText: { fontSize: 12, fontWeight: "600", color: colors.brandDeep },
  // web ul flex flex-col gap-3
  list: { gap: spacing.md },
  // web li flex gap-2
  row: { flexDirection: "row", gap: spacing.sm },
  rowBody: { flex: 1, minWidth: 0 },
  // web inline-block max-w-full rounded-2xl bg-zinc-100 px-3 py-2
  bubble: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderRadius: BUBBLE_RADIUS,
    backgroundColor: colors.bgAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  name: { fontSize: 12, fontWeight: "600", color: colors.ink },
  text: { fontSize: 14, lineHeight: 20, color: colors.ink },
  // web mt-0.5 flex items-center gap-3 px-3 text-[11px] text-zinc-500
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: 2,
    paddingHorizontal: spacing.md,
  },
  metaText: { fontSize: 11, color: colors.ink3 },
  delete: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2 },
  deletePressed: { opacity: 0.6 },
  // web form flex items-end gap-2
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  // web min-h-9 flex-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    borderRadius: BUBBLE_RADIUS,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontSize: 14,
    lineHeight: 18,
    color: colors.ink,
    textAlignVertical: "top",
  },
  // web focus-visible:border-mango-brand-deep
  inputFocused: { borderColor: colors.brandDeep },
  // web grid size-9 shrink-0 place-items-center rounded-full bg-mango-brand text-white
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendPressed: { backgroundColor: colors.brandDeep },
  // web disabled:opacity-50
  sendDisabled: { opacity: 0.5 },
  remaining: { fontSize: 11, color: colors.ink3, textAlign: "right" },
  // web px-1 text-xs text-red-600
  error: { paddingHorizontal: 4, fontSize: 12, color: colors.danger },
});
