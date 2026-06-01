"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhTW } from "date-fns/locale";
import { Send, Trash2 } from "lucide-react";
import { Timestamp, type QueryDocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/components/auth/auth-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Avatar } from "@/components/ui/avatar";
import {
  createComment,
  deleteComment,
  listComments,
} from "@/lib/firebase/posts";
import { COMMENT_MAX_LEN, type Comment } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  postId: string;
  /** Post author — allowed to delete any comment on their own post
   *  (matches the firestore.rules delete guard). */
  postAuthorUid: string;
  /** DOM id so the PostCard toggle can `aria-controls` this region. */
  id?: string;
  /** Bubble count deltas up so the card's comment badge stays in sync
   *  without a re-fetch (denormalised post.commentCount is maintained
   *  server-side; this is the optimistic local mirror). */
  onCountChange?: (delta: number) => void;
};

const PAGE_SIZE = 20;

/**
 * Expandable comment thread for a feed post (feed-comments-and-reactions
 * -v2 §A). Mounted lazily by PostCard only when the user opens comments,
 * so the read happens on demand (cost note: no onSnapshot). Comments load
 * oldest-first via the paginated `listComments` cursor; the input sits at
 * the bottom and new comments optimistically append there.
 */
export function CommentSection({ postId, postAuthorUid, id, onCountChange }: Props) {
  const t = useTranslations("Comments");
  const tC = useTranslations("Common");
  const locale = useLocale();
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;
  const { user } = useAuth();
  const askConfirm = useConfirm();

  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Initial page — runs once on mount (component only mounts when the
  // thread is opened).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await listComments(postId, PAGE_SIZE, null);
        if (!cancelled) {
          setComments(page.comments);
          setCursor(page.cursor);
        }
      } catch {
        if (!cancelled) setError(t("loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, t]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listComments(postId, PAGE_SIZE, cursor);
      setComments((prev) => [...prev, ...page.comments]);
      setCursor(page.cursor);
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, postId, t]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!user || submitting || !body) return;
    if (body.length > COMMENT_MAX_LEN) {
      setError(t("tooLong", { max: COMMENT_MAX_LEN }));
      return;
    }
    setSubmitting(true);
    setError(null);

    // Optimistic append at the bottom (chronological). Temp id is swapped
    // for the real one on success; createdAt uses a local now-stamp until
    // the server value would land (we don't re-read — close enough for the
    // relative-time label).
    const tempId = `temp-${postId}-${comments.length}`;
    const optimistic: Comment = {
      commentId: tempId,
      authorUid: user.uid,
      authorName: user.displayName ?? "",
      authorPhotoURL: user.photoURL ?? null,
      text: body,
      createdAt: Timestamp.now(),
    };
    setComments((prev) => [...prev, optimistic]);
    setText("");
    onCountChange?.(1);

    try {
      const { commentId } = await createComment({
        postId,
        authorUid: user.uid,
        authorName: user.displayName ?? "",
        authorPhotoURL: user.photoURL ?? null,
        text: body,
      });
      setComments((prev) =>
        prev.map((c) => (c.commentId === tempId ? { ...c, commentId } : c)),
      );
    } catch {
      // Roll back the optimistic row + restore the draft so the user can
      // retry without retyping.
      setComments((prev) => prev.filter((c) => c.commentId !== tempId));
      setText(body);
      onCountChange?.(-1);
      setError(t("sendFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(comment: Comment) {
    const ok = await askConfirm({
      title: t("deleteTitle"),
      message: comment.text.slice(0, 60),
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    const prev = comments;
    setComments((cs) => cs.filter((c) => c.commentId !== comment.commentId));
    onCountChange?.(-1);
    try {
      await deleteComment(postId, comment.commentId);
    } catch {
      setComments(prev);
      onCountChange?.(1);
      setError(t("deleteFailed"));
    }
  }

  function relTime(ts: Comment["createdAt"]): string {
    const ms =
      (ts as { toMillis?: () => number } | undefined)?.toMillis?.() ??
      Date.now();
    return formatDistanceToNow(new Date(ms), {
      addSuffix: true,
      locale: dateLocale,
    });
  }

  const canDelete = (c: Comment) =>
    !!user && (c.authorUid === user.uid || postAuthorUid === user.uid);

  return (
    <div id={id} className="mt-1 flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
      {loading ? (
        <p className="px-1 text-sm text-zinc-500">{t("loading")}</p>
      ) : comments.length === 0 ? (
        <p className="px-1 py-2 text-center text-sm text-zinc-500">
          {t("empty")}
        </p>
      ) : (
        <>
          {cursor && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="self-start rounded-full px-2 py-1 text-xs font-semibold text-mango-brand-deep transition-colors hover:bg-mango-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep disabled:opacity-60"
            >
              {loadingMore ? t("loading") : t("loadMore")}
            </button>
          )}
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <li key={c.commentId} className="flex gap-2">
                <Avatar src={c.authorPhotoURL} name={c.authorName} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="inline-block max-w-full rounded-2xl bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
                    <p className="text-xs font-semibold">{c.authorName}</p>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {c.text}
                    </p>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 px-3 text-[11px] text-zinc-500">
                    <span>{relTime(c.createdAt)}</span>
                    {canDelete(c) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        className="inline-flex items-center gap-1 rounded transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:text-red-400"
                      >
                        <Trash2 className="size-3" aria-hidden="true" />
                        {t("delete")}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Composer — bottom-anchored, optimistic append. Enter sends,
          Shift+Enter newlines; the send button is the touch / a11y path. */}
      {user && (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Avatar src={user.photoURL} name={user.displayName ?? ""} size={32} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            rows={1}
            maxLength={COMMENT_MAX_LEN}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            className="min-h-9 flex-1 resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:border-mango-brand-deep focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mango-brand-deep dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            aria-label={t("send")}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-mango-brand text-white transition-colors hover:bg-mango-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
          >
            <Send className="size-4" aria-hidden="true" />
          </button>
        </form>
      )}

      {error && (
        <p className="px-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
