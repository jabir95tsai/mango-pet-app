import type { LucideIcon } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300/80 bg-white/75 px-6 py-12 text-center shadow-sm shadow-zinc-200/40 dark:border-zinc-700 dark:bg-zinc-900/55 dark:shadow-none">
      {Icon && (
        <span className="grid size-12 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Icon className="size-6" />
        </span>
      )}
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      {description && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
