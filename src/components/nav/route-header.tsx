import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  className?: string;
  /**
   * Optional right-aligned slot next to the title — e.g. a mobile-only
   * overflow trigger. Subtitles still wrap underneath without pushing the
   * action off-screen.
   */
  action?: ReactNode;
};

export function RouteHeader({ title, subtitle, className, action }: Props) {
  return (
    <header className={className ?? "mb-6"}>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 sm:text-3xl">
          {title}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {subtitle && (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {subtitle}
        </p>
      )}
    </header>
  );
}
