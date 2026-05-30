"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/set-locale";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "zh-TW", label: "繁中" },
  { value: "en", label: "EN" },
] as const;

export function LanguageSwitcher() {
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div className="inline-flex rounded-lg border border-zinc-200/80 bg-white p-0.5 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => setLocale(opt.value))}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
            current === opt.value
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
              : "text-zinc-600 hover:text-amber-700 dark:text-zinc-400 dark:hover:text-amber-300",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
