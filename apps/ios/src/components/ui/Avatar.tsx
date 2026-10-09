/**
 * Avatar — unified photo-or-initials avatar (UX-0). One primitive, two web
 * references selected by `variant` (defaulted from `shape` so the legacy
 * PetAvatar / UserAvatar shims keep working untouched):
 *
 *  - "person" (default for shape="circle") → apps/web/src/components/ui/avatar.tsx
 *    initialsOf(): one word → its first 2 characters, several words → first +
 *    last initial, uppercased ("Jabir Tsai" → "JT", "芒果" → "芒果"); font
 *    steps 12 / 14 / 18 by size (text-xs / text-sm / text-lg) at weight 600.
 *    The disc stays brandTint + brandDeep (the SoT mango palette); web's
 *    rose / sky / violet hash palette is off-brand and deliberately not copied.
 *  - "pet" (default for shape="rounded") → apps/web/src/components/pets/pet-avatar.tsx
 *    first grapheme at 0.42×size, weight 800, plus the small white paw badge
 *    at ≥48pt.
 *
 * A broken photo URL falls back to the initials disc (web pet-avatar onError).
 * Grapheme handling uses Array.from (surrogate-pair / emoji safe).
 */
import { useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";

import { colors } from "@/theme/theme";

export type AvatarShape = "circle" | "rounded";
export type AvatarVariant = "person" | "pet";

/** Port of web ui/avatar initialsOf(); returns null for an empty name. */
export function initialsOf(name: string | null | undefined): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  const first = Array.from(parts[0])[0] ?? "";
  const last = Array.from(parts[parts.length - 1])[0] ?? "";
  return (first + last).toUpperCase();
}

/** First grapheme of the name (web pet-avatar firstChar). */
function firstChar(name: string | null | undefined): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  return Array.from(trimmed)[0] ?? null;
}

function PawBadge() {
  return (
    <View style={styles.paw} pointerEvents="none">
      <Svg width={10} height={10} viewBox="0 0 24 24" fill={colors.brandDeep}>
        <Ellipse cx="6.5" cy="9" rx="1.8" ry="2.3" />
        <Ellipse cx="17.5" cy="9" rx="1.8" ry="2.3" />
        <Ellipse cx="9.5" cy="5.5" rx="1.6" ry="2.1" />
        <Ellipse cx="14.5" cy="5.5" rx="1.6" ry="2.1" />
        <Path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z" />
      </Svg>
    </View>
  );
}

export function Avatar({
  name,
  photoURL,
  size = 40,
  shape = "circle",
  variant,
  fallbackChar = "🙂",
  accessibilityLabel,
  style,
}: {
  name: string;
  photoURL?: string | null;
  size?: number;
  shape?: AvatarShape;
  /** Which web avatar to mirror; defaults from `shape` (circle → person, rounded → pet). */
  variant?: AvatarVariant;
  /** Shown when the name is empty. */
  fallbackChar?: string;
  /** When set, the avatar is announced as an image with this label (default: decorative). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const kind: AvatarVariant = variant ?? (shape === "rounded" ? "pet" : "person");
  const borderRadius = shape === "circle" ? size / 2 : Math.round(size * 0.34);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photoURL]);

  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel }
    : { accessible: false };

  if (photoURL && !broken) {
    return (
      <Image
        {...a11y}
        accessibilityIgnoresInvertColors
        source={{ uri: photoURL }}
        onError={() => setBroken(true)}
        style={[
          { width: size, height: size, borderRadius, backgroundColor: colors.brandTint },
          style as StyleProp<ImageStyle>,
        ]}
      />
    );
  }

  const isPet = kind === "pet";
  const text = (isPet ? firstChar(name) : initialsOf(name)) ?? fallbackChar;
  const fontSize = isPet ? Math.round(size * 0.42) : size > 48 ? 18 : size > 32 ? 14 : 12;

  return (
    <View {...a11y} style={[styles.disc, { width: size, height: size, borderRadius }, style]}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          styles.text,
          isPet ? styles.textPet : styles.textPerson,
          { fontSize, lineHeight: Math.round(fontSize * 1.2) },
        ]}
      >
        {text}
      </Text>
      {isPet && size >= 48 ? <PawBadge /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  text: { color: colors.brandDeep, textAlign: "center" },
  textPerson: { fontWeight: "600" },
  textPet: { fontWeight: "800", letterSpacing: -0.5 },
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
    shadowColor: colors.paw,
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
