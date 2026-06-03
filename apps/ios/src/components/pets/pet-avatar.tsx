/**
 * Pet avatar — thin shim over the shared UX-0 Avatar primitive (rounded-square
 * shape, paw fallback). Kept as a named export so existing pet call sites don't
 * need a sweeping rename. Sized 64 (header), 34 (switcher rows), 96 (empty hero).
 */
import { Avatar } from "@/components/ui/Avatar";

export function PetAvatar({
  name,
  photoURL,
  size = 64,
}: {
  name: string;
  photoURL?: string;
  size?: number;
}) {
  return (
    <Avatar name={name} photoURL={photoURL} size={size} shape="rounded" fallbackChar="🐾" />
  );
}
