"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ArticleCard } from "@/components/knowledge/article-card";
import {
  listArticles,
  listBookmarkedIds,
  toggleBookmark,
} from "@/lib/firebase/knowledge";
import { cn } from "@/lib/utils";
import type { KnowledgeArticle, KnowledgeCategory } from "@/lib/types";

type Filter = KnowledgeCategory | "all" | "bookmarked";

const FILTER_VALUES: Filter[] = [
  "all",
  "bookmarked",
  "feeding",
  "training",
  "health",
  "breed",
  "lifestyle",
];

export default function KnowledgePage() {
  const t = useTranslations("Nav");
  const tC = useTranslations("Common");
  const tK = useTranslations("Knowledge");
  const { user } = useAuth();

  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [list, marks] = await Promise.all([
        listArticles(),
        listBookmarkedIds(user.uid),
      ]);
      setArticles(list);
      setBookmarks(marks);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleBookmark(articleId: string) {
    if (!user) return;
    const isBookmarked = bookmarks.has(articleId);
    const next = new Set(bookmarks);
    if (isBookmarked) next.delete(articleId);
    else next.add(articleId);
    setBookmarks(next);
    try {
      await toggleBookmark(user.uid, articleId, isBookmarked);
    } catch {
      setBookmarks(bookmarks);
    }
  }

  const filtered = articles.filter((a) => {
    if (filter === "all") return true;
    if (filter === "bookmarked") return bookmarks.has(a.articleId);
    return a.category === filter;
  });

  return (
    <>
      <RouteHeader title={t("knowledge")} subtitle={tK("subtitle")} />

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-4">
        {FILTER_VALUES.map((value) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={active}
              className={cn(
                "h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-800",
              )}
            >
              {tK(`filters.${value}`)}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={
            filter === "bookmarked"
              ? tK("emptyBookmarked.title")
              : tK("emptyAll.title")
          }
          description={
            filter === "bookmarked"
              ? tK("emptyBookmarked.subtitle")
              : tK("emptyAll.subtitle")
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((a) => (
            <ArticleCard
              key={a.articleId}
              article={a}
              bookmarked={bookmarks.has(a.articleId)}
              onToggleBookmark={() => handleBookmark(a.articleId)}
            />
          ))}
        </div>
      )}
    </>
  );
}
