"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Users, Lock, MessageCircle, Trash2 } from "lucide-react";
import type { Post, Visibility } from "@/lib/types";
import { useAuth } from "@/components/auth/auth-provider";
import { GuestLockedNotice } from "@/components/auth/guest-upgrade";
import { Avatar } from "@/components/ui/avatar";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { EmojiReactions } from "./emoji-reactions";
import { CommentSection } from "./comment-section";
import { cn } from "@/lib/utils";

type Props = {
  post: Post;
  currentUid: string;
  onDelete?: () => void;
};

const VISIBILITY_ICON: Record<Visibility, typeof Globe> = {
  public: Globe,
  friends: Users,
  private: Lock,
};

export function PostCard({ post, currentUid, onDelete }: Props) {
  const locale = useLocale();
  const tC = useTranslations("Common");
  const tPL = useTranslations("PhotoLightbox");
  const tCm = useTranslations("Comments");
  const { isGuest } = useAuth();
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;
  const VIcon = VISIBILITY_ICON[post.visibility];

  // Lightbox state owned by the card — one set per post since each post
  // has its own photo collection. Tapping any photo opens the lightbox
  // at that photo's index.
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  // Comments are loaded lazily — the thread only mounts (and reads) when
  // opened. `commentCount` starts from the denormalised post field (absent
  // on legacy posts → 0) and is nudged optimistically as the user adds /
  // removes their own comments; the server trigger is the source of truth.
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const commentsId = `comments-${post.postId}`;

  const createdMs =
    (post.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ??
    Date.now();
  const relTime = formatDistanceToNow(new Date(createdMs), {
    addSuffix: true,
    locale: dateLocale,
  });

  const isMine = post.authorUid === currentUid;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
      <header className="flex items-center gap-3">
        <Avatar src={post.authorPhotoURL} name={post.authorName} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{post.authorName}</p>
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <VIcon className="size-3" />
            {relTime}
          </p>
        </div>
        {isMine && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
            aria-label={tC("delete")}
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      {post.text && <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.text}</p>}

      {post.photoURLs.length > 0 && (
        <div
          className={cn(
            "grid gap-2 overflow-hidden rounded-lg",
            post.photoURLs.length === 1 && "grid-cols-1",
            post.photoURLs.length === 2 && "grid-cols-2",
            post.photoURLs.length >= 3 && "grid-cols-2",
          )}
        >
          {post.photoURLs.map((url, idx) => (
            <button
              key={url}
              type="button"
              onClick={() => {
                setLightboxIdx(idx);
                setLightboxOpen(true);
              }}
              aria-label={tPL("counter", {
                current: idx + 1,
                total: post.photoURLs.length,
              })}
              className="group relative aspect-square overflow-hidden bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 300px"
                className="object-cover transition-transform group-hover:scale-[1.02]"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}

      {/* Reactions + comments need a real identity — guests get an upgrade
          nudge in place of the interactive row. They can still read the
          post above. Spec §C (留言 / 表情 → guest 不可用). */}
      {isGuest ? (
        <GuestLockedNotice feature="reactions" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <EmojiReactions
              postId={post.postId}
              uid={currentUid}
              counts={post.reactionCounts}
            />
            <button
              type="button"
              onClick={() => setCommentsOpen((o) => !o)}
              aria-expanded={commentsOpen}
              aria-controls={commentsId}
              aria-label={tCm("toggle")}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {commentCount > 0 && (
                <span className="text-xs font-medium tabular-nums">
                  {commentCount}
                </span>
              )}
            </button>
          </div>

          {commentsOpen && (
            <CommentSection
              id={commentsId}
              postId={post.postId}
              postAuthorUid={post.authorUid}
              onCountChange={(d) => setCommentCount((c) => Math.max(0, c + d))}
            />
          )}
        </>
      )}

      <PhotoLightbox
        photos={post.photoURLs}
        initialIdx={lightboxIdx}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </article>
  );
}
