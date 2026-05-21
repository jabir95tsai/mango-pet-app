type Props = {
  title: string;
  subtitle?: string;
  className?: string;
};

export function RouteHeader({ title, subtitle, className }: Props) {
  return (
    <header className={className ?? "mb-6"}>
      <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 sm:text-3xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {subtitle}
        </p>
      )}
    </header>
  );
}
