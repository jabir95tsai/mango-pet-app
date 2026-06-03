/**
 * Person avatar for feed posts + comments — thin shim over the shared UX-0
 * Avatar primitive (circle shape, smiley fallback). Kept as a named export so
 * existing feed call sites don't need a sweeping rename.
 */
import { Avatar } from "@/components/ui/Avatar";

export function UserAvatar({
  name,
  photoURL,
  size = 40,
}: {
  name: string;
  photoURL?: string | null;
  size?: number;
}) {
  return (
    <Avatar name={name} photoURL={photoURL} size={size} shape="circle" fallbackChar="🙂" />
  );
}
