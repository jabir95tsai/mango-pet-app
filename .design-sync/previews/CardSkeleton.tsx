import { CardSkeleton } from "@mango/web";

/** The loading placeholder for one list card (avatar circle + two text lines). */
export const Default = () => (
  <div className="w-80">
    <CardSkeleton />
  </div>
);

/** Full-width inside a wider page column. */
export const InColumn = () => (
  <div className="w-[420px]">
    <CardSkeleton />
  </div>
);
