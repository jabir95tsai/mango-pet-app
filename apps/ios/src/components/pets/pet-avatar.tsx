/**
 * Pet avatar — photoURL image, or a brand-tint disc with the pet's first
 * character (CJK / emoji-safe) when there's no photo. Mirrors the web
 * pet-avatar fallback. Sized 64 (header), 34 (switcher rows), 96 (empty hero).
 */
import { Image, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/theme";

/** First grapheme of the name (handles CJK + emoji surrogate pairs). */
function firstChar(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "🐾";
  return Array.from(trimmed)[0] ?? "🐾";
}

export function PetAvatar({
  name,
  photoURL,
  size = 64,
}: {
  name: string;
  photoURL?: string;
  size?: number;
}) {
  const borderRadius = Math.round(size * 0.34);
  if (photoURL) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: photoURL }}
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: colors.brandTint,
        }}
      />
    );
  }
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius }]}>
      <Text
        style={{
          fontSize: Math.round(size * 0.42),
          fontWeight: "800",
          color: colors.brandDeep,
        }}
      >
        {firstChar(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
});
