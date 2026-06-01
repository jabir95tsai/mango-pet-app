"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  const t = useTranslations("Error");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 gap-6 text-center">
      <span className="text-6xl" role="img" aria-label="oops">
        🥭💔
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-zinc-500 max-w-md">
          {error.message || "Something went wrong"}
        </p>
        {error.digest && (
          <p className="text-xs text-zinc-400">ref: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-mango h-10 rounded-lg px-5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          {t("retry")}
        </button>
        <Link
          href="/"
          className="flex h-10 items-center rounded-lg border border-zinc-200 px-5 text-sm font-medium hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
