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

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "bookmarked", label: "⭐ 收藏" },
  { value: "feeding", label: "餵食" },
  { value: "training", label: "訓練" },
  { value: "health", label: "健康" },
  { value: "breed", label: "品種" },
  { value: "lifestyle", label: "生活" },
];

export default function KnowledgePage() {
  const t = useTranslations("Nav");
  const tC = useTranslations("Common");
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
      <RouteHeader title={t("knowledge")} subtitle="寵物照護知識" />

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-4">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={active}
              className={cn(
                "h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-800",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={filter === "bookmarked" ? "尚無收藏" : "知識庫建置中"}
          description={
            filter === "bookmarked"
              ? "點 🔖 圖示收藏喜歡的文章。"
              : "管理員會持續新增文章，先看其他類別。"
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
