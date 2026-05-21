"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { ArrowLeft, Bookmark, BookmarkCheck, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getArticle,
  listBookmarkedIds,
  toggleBookmark,
} from "@/lib/firebase/knowledge";
import { cn } from "@/lib/utils";
import type { KnowledgeArticle } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";

export default function ArticlePage() {
  const router = useRouter();
  const params = useParams<{ articleId: string }>();
  const articleId = params.articleId;
  const { user } = useAuth();
  const locale = useLocale();
  const lang = locale === "zh-TW" ? "zh-TW" : "en";
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;
  const tC = useTranslations("Common");

  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [a, marks] = await Promise.all([
        getArticle(articleId),
        listBookmarkedIds(user.uid),
      ]);
      setArticle(a);
      setBookmarked(marks.has(articleId));
    } finally {
      setLoading(false);
    }
  }, [user, articleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleToggleBookmark() {
    if (!user) return;
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await toggleBookmark(user.uid, articleId, bookmarked);
    } catch {
      setBookmarked(!next);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">{tC("loading")}</p>;

  if (!article) {
    return (
      <EmptyState
        icon={BookOpen}
        title="找不到文章"
        action={
          <Button variant="secondary" onClick={() => router.push("/app/knowledge")}>
            <ArrowLeft className="size-4" />
            {tC("back")}
          </Button>
        }
      />
    );
  }

  const title = article.title[lang] ?? article.title["zh-TW"];
  const content = article.contentMd[lang] ?? article.contentMd["zh-TW"];
  const publishedAt = (article.publishedAt as Timestamp | undefined)?.toMillis?.();

  return (
    <article>
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          type="button"
          onClick={() => router.push("/app/knowledge")}
          aria-label={tC("back")}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={handleToggleBookmark}
          aria-label="bookmark"
          className={cn(
            "rounded-lg p-2",
            bookmarked
              ? "text-amber-600"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-amber-500 dark:hover:bg-zinc-800",
          )}
        >
          {bookmarked ? (
            <BookmarkCheck className="size-5 fill-current" />
          ) : (
            <Bookmark className="size-5" />
          )}
        </button>
      </div>

      {article.coverImageURL && (
        <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-lg bg-surface-muted">
          <Image
            src={article.coverImageURL}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <header className="mb-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-xs text-zinc-500 mt-1">
          {article.authorName}
          {publishedAt && ` · ${format(new Date(publishedAt), "yyyy-MM-dd", { locale: dateLocale })}`}
        </p>
      </header>

      <div className="prose prose-sm prose-zinc max-w-none prose-headings:font-semibold prose-a:text-emerald-700 prose-img:rounded-lg dark:prose-invert dark:prose-a:text-emerald-300">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </article>
  );
}
