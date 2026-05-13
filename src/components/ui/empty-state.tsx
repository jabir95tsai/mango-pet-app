import type { LucideIcon } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-12 px-6 rounded-2xl border border-dashed border-amber-300/60 bg-amber-50/40 dark:border-zinc-700 dark:bg-zinc-900/40">
      {Icon && <Icon className="size-10 text-amber-500" />}
      <h2 className="font-semibold">{title}</h2>
      {description && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
