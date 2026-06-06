/**
 * Comment section (P3a) — mirrors web comment-section. Lazy-mounted by PostCard
 * only when the user opens comments. Loads oldest-first, cursor-paginated (20).
 * Optimistic append with rollback; delete allowed for the comment author OR the
 * post author. Bubbles count deltas up so PostCard's badge stays in sync without
 * a refetch. commentCount denorm is server-maintained — we never write it.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Trash2 } from "lucide-react-native";
import { COMMENT_MAX_LEN, type Comment } from "@mango/shared-types";
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

import {
  createComment,
  deleteComment,
  listComments,
} from "@/lib/posts";
import { useAuth } from "@/state/auth-context";
import { relativeTime } from "@/lib/format";
import { colors, radius, spacing } from "@/theme/theme";
import { UserAvatar } from "./user-avatar";

type Cursor = FirebaseFirestoreTypes.QueryDocumentSnapshot | null;

export function CommentSection({
  postId,
  postAuthorUid,
  onCountChange,
}: {
  postId: string;
  postAuthorUid: string;
  onCountChange?: (delta: number) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listComments(postId, 20, null);
      setComments(page.comments);
      setCursor(page.cursor);
    } catch {
      setError("無法載入留言");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listComments(postId, 20, cursor);
      setComments((prev) => [...prev, ...page.comments]);
      setCursor(page.cursor);
    } catch {
      // keep existing list; silent
    } finally {
      setLoadingMore(false);
    }
  }

  async function submit() {
    if (!user || submitting) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > COMMENT_MAX_LEN) {
      setError(`留言最多 ${COMMENT_MAX_LEN} 字`);
      return;
    }
    setError(null);
    setSubmitting(true);
    const tempId = `temp-${postId}-${comments.length}-${trimmed.length}`;
    const optimistic: Comment = {
      commentId: tempId,
      authorUid: user.uid,
      authorName: user.displayName ?? user.email?.split("@")[0] ?? "Friend",
      authorPhotoURL: user.photoURL,
      text: trimmed,
      // null serverTimestamp until re-read; relativeTime() treats it as 剛剛
      createdAt: undefined as unknown as Comment["createdAt"],
    };
    setComments((prev) => [...prev, optimistic]);
    const draft = text;
    setText("");
    onCountChange?.(1);
    try {
      const { commentId } = await createComment({
        postId,
        authorUid: user.uid,
        authorName: optimistic.authorName,
        authorPhotoURL: optimistic.authorPhotoURL,
        text: trimmed,
      });
      setComments((prev) =>
        prev.map((c) => (c.commentId === tempId ? { ...c, commentId } : c)),
      );
    } catch (e) {
      // rollback
      setComments((prev) => prev.filter((c) => c.commentId !== tempId));
      setText(draft);
      onCountChange?.(-1);
      setError(e instanceof Error ? e.message : "留言失敗");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(c: Comment) {
    if (c.commentId.startsWith("temp-")) return;
    const prev = comments;
    setComments((p) => p.filter((x) => x.commentId !== c.commentId));
    onCountChange?.(-1);
    try {
      await deleteComment(postId, c.commentId);
    } catch {
      setComments(prev);
      onCountChange?.(1);
    }
  }

  const remaining = COMMENT_MAX_LEN - text.length;

  return (
    <View style={styles.wrap}>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : (
        <>
          {comments.length === 0 ? (
            <Text style={styles.empty}>還沒有留言，搶頭香！</Text>
          ) : (
            comments.map((c) => {
              const canDelete =
                user != null &&
                (c.authorUid === user.uid || postAuthorUid === user.uid);
              return (
                <View key={c.commentId} style={styles.commentRow}>
                  <UserAvatar
                    name={c.authorName}
                    photoURL={c.authorPhotoURL}
                    size={32}
                  />
                  <View style={styles.commentBody}>
                    <View style={styles.commentHead}>
                      <Text style={styles.commentName}>{c.authorName}</Text>
                      <Text style={styles.commentTime}>
                        {relativeTime(c.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                  {canDelete ? (
                    <Pressable
                      accessibilityLabel="刪除留言"
                      onPress={() => remove(c)}
                      hitSlop={8}
                      style={styles.del}
                    >
                      <Trash2 size={13} color={colors.ink3} strokeWidth={2} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}

          {cursor ? (
            <Pressable
              onPress={loadMore}
              disabled={loadingMore}
              style={styles.more}
            >
              <Text style={styles.moreText}>
                {loadingMore ? "載入中…" : "載入更多留言"}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="留個言…"
          placeholderTextColor={colors.ink3}
          multiline
          maxLength={COMMENT_MAX_LEN}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="送出留言"
          onPress={submit}
          disabled={submitting || !text.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            (submitting || !text.trim()) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.card} size="small" />
          ) : (
            <Text style={styles.sendText}>送出</Text>
          )}
        </Pressable>
      </View>
      {text.length > COMMENT_MAX_LEN - 50 ? (
        <Text style={styles.remaining}>{remaining}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    gap: spacing.sm,
  },
  loader: { marginVertical: spacing.md },
  empty: { fontSize: 13, color: colors.ink3, paddingVertical: spacing.xs },
  commentRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  commentBody: { flex: 1 },
  commentHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  commentName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  commentTime: { fontSize: 11, color: colors.ink3 },
  commentText: { fontSize: 14, color: colors.ink, marginTop: 1 },
  del: { padding: 4 },
  delText: { fontSize: 13, color: colors.ink3, fontWeight: "700" },
  more: { paddingVertical: spacing.sm, alignItems: "center" },
  moreText: { fontSize: 13, fontWeight: "600", color: colors.brandDeep },
  error: { fontSize: 12, color: colors.cookie },
  inputRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: "top",
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { fontSize: 14, fontWeight: "800", color: colors.card },
  remaining: { fontSize: 11, color: colors.ink3, textAlign: "right" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
