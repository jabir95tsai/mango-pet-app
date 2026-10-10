/**
 * Pet avatar — thin shim over the shared UX-0 Avatar primitive (rounded-square
 * shape, initial fallback; a broken photo URL falls back inside Avatar).
 * Sized 64 (header), 34 (switcher rows).
 *
 * Web pet-avatar parity: without a photo, sizes ≥ 48 get a 16pt white/90 paw
 * badge at right 4 / bottom 4 (too crowded at 34, so skipped there).
 */
import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { PawIcon } from "@/components/walks/paw-icon";
import { colors } from "@/theme/theme";

export function PetAvatar({
  name,
  photoURL,
  size = 64,
}: {
  name: string;
  photoURL?: string;
  size?: number;
}) {
  const avatar = (
    <Avatar name={name} photoURL={photoURL} size={size} shape="rounded" fallbackChar="🐾" />
  );
  if (photoURL || size < 48) return avatar;
  return (
    <View>
      {avatar}
      <View style={styles.paw} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <PawIcon size={10} color={colors.brandDeep} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // web: absolute right-1 bottom-1 size-4 rounded-full bg-white/90 shadow-sm
  paw: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
  },
});
