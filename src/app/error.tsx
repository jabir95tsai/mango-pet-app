"use client";

import { useEffect } from "react";
import Link from "next/link";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 gap-6 text-center">
      <span className="text-6xl" role="img" aria-label="oops">
        🥭💔
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">出了點狀況</h1>
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
          className="h-10 px-5 rounded-full bg-amber-500 text-white text-sm font-medium hover:bg-amber-600"
        >
          重試
        </button>
        <Link
          href="/"
          className="h-10 px-5 rounded-full border border-zinc-200 text-sm font-medium flex items-center hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          回首頁
        </Link>
      </div>
    </main>
  );
}
