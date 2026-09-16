import { Skeleton } from "@mango/web";

/** Sized via className — the primitive is a pulsing rounded block. */
export const Shapes = () => (
  <div className="flex items-center gap-4">
    <Skeleton className="size-12 rounded-full" />
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-10 w-24" />
    <Skeleton className="h-16 w-16" />
  </div>
);

/** Text-block placeholder — stacked lines of varying width. */
export const TextLines = () => (
  <div className="flex w-72 flex-col gap-2">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-5/6" />
    <Skeleton className="h-3 w-2/3" />
  </div>
);

/** Media placeholder — a photo tile with caption lines. */
export const MediaTile = () => (
  <div className="flex w-56 flex-col gap-2">
    <Skeleton className="aspect-square w-full rounded-[var(--radius-xl)]" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-3 w-1/3" />
  </div>
);
