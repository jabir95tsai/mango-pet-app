"use client";

import { cn } from "@/lib/utils";

type Props<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  className?: string;
};

export function Tabs<T extends string>({ value, onChange, options, className }: Props<T>) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900",
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-8 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
              active
                ? "bg-white text-amber-700 shadow-sm dark:bg-zinc-950 dark:text-amber-300"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
