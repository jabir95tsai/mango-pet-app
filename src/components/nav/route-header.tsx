type Props = {
  title: string;
  subtitle?: string;
};

export function RouteHeader({ title, subtitle }: Props) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{subtitle}</p>
      )}
    </header>
  );
}
