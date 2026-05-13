"use client";

import { formatDistanceToNow } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { Star, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";
import type { RestaurantReview } from "@/lib/types";

type Props = {
  review: RestaurantReview;
  currentUid: string;
  onDelete?: () => void;
};

export function ReviewCard({ review, currentUid, onDelete }: Props) {
  const locale = useLocale();
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;
  const ts = review.createdAt as Timestamp | undefined;
  const ms = ts?.toMillis() ?? Date.now();
  const rel = formatDistanceToNow(new Date(ms), { addSuffix: true, locale: dateLocale });
  const isMine = review.authorUid === currentUid;

  return (
    <article className="rounded-2xl border border-amber-200/60 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col gap-2">
      <header className="flex items-center gap-3">
        <Avatar src={review.authorPhotoURL} name={review.authorName} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{review.authorName}</p>
          <div className="flex gap-1 items-center mt-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={cn(
                  "size-3.5",
                  n <= review.rating ? "fill-amber-400 text-amber-400" : "text-zinc-300",
                )}
              />
            ))}
            <span className="text-xs text-zinc-500 ml-1">· {rel}</span>
          </div>
        </div>
        {isMine && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="delete"
            className="p-2 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{review.text}</p>
    </article>
  );
}
