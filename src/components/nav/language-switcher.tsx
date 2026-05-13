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
    <div className="inline-flex rounded-full border border-amber-200/60 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => setLocale(opt.value))}
          className={cn(
            "px-3 py-1 text-xs rounded-full font-medium transition-colors",
            current === opt.value
              ? "bg-amber-500 text-white"
              : "text-zinc-600 hover:text-amber-600 dark:text-zinc-400",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
