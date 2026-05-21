"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Users, Lock, Trash2 } from "lucide-react";
import type { Post, Visibility } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { EmojiReactions } from "./emoji-reactions";
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
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;
  const VIcon = VISIBILITY_ICON[post.visibility];

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
          {post.photoURLs.map((url) => (
            <div key={url} className="relative aspect-square bg-zinc-100">
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 300px"
                className="object-cover"
                unoptimized
              />
            </div>
          ))}
        </div>
      )}

      <EmojiReactions
        postId={post.postId}
        uid={currentUid}
        counts={post.reactionCounts}
      />
    </article>
  );
}
