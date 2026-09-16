import { CardSkeletonList } from "@mango/web";

/** Default count (3). */
export const Default = () => (
  <div className="w-80">
    <CardSkeletonList />
  </div>
);

/** Two placeholders. */
export const Two = () => (
  <div className="w-80">
    <CardSkeletonList count={2} />
  </div>
);

/** Five placeholders — a longer list loading. */
export const Five = () => (
  <div className="w-80">
    <CardSkeletonList count={5} />
  </div>
);
