"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocale } from "next-intl";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeArticle, KnowledgeCategory } from "@/lib/types";

type Props = {
  article: KnowledgeArticle;
  bookmarked: boolean;
  onToggleBookmark: () => void;
};

const CATEGORY_COLOR: Record<KnowledgeCategory, string> = {
  feeding: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  training: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  health: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  breed: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  lifestyle: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
};

const CATEGORY_LABEL_ZH: Record<KnowledgeCategory, string> = {
  feeding: "餵食",
  training: "訓練",
  health: "健康",
  breed: "品種",
  lifestyle: "生活",
};

const CATEGORY_LABEL_EN: Record<KnowledgeCategory, string> = {
  feeding: "Feeding",
  training: "Training",
  health: "Health",
  breed: "Breed",
  lifestyle: "Lifestyle",
};

export function ArticleCard({ article, bookmarked, onToggleBookmark }: Props) {
  const locale = useLocale();
  const lang = locale === "zh-TW" ? "zh-TW" : "en";
  const title = article.title[lang] ?? article.title["zh-TW"];
  const excerpt = article.excerpt?.[lang] ?? "";
  const labelMap = lang === "zh-TW" ? CATEGORY_LABEL_ZH : CATEGORY_LABEL_EN;

  return (
    <article className="flex gap-3 rounded-lg border border-amber-200/80 bg-white p-3 shadow-sm shadow-amber-100/70 transition-colors hover:border-amber-400 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
      <Link
        href={`/app/knowledge/${article.articleId}`}
        className="flex min-w-0 flex-1 gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        {article.coverImageURL && (
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
            <Image
              src={article.coverImageURL}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                CATEGORY_COLOR[article.category],
              )}
            >
              {labelMap[article.category]}
            </span>
          </div>
          <h3 className="font-semibold text-sm line-clamp-2">{title}</h3>
          {excerpt && (
            <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{excerpt}</p>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={onToggleBookmark}
        aria-label="bookmark"
        className={cn(
          "self-start rounded-lg p-2",
          bookmarked
            ? "text-amber-600"
            : "text-zinc-400 hover:bg-zinc-100 hover:text-amber-500 dark:hover:bg-zinc-800",
        )}
      >
        {bookmarked ? (
          <BookmarkCheck className="size-4 fill-current" />
        ) : (
          <Bookmark className="size-4" />
        )}
      </button>
    </article>
  );
}
