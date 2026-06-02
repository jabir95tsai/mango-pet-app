/**
 * Circular person avatar for feed posts + comments — photoURL image, or a
 * brand-tint disc with the first grapheme of the name. Mirrors the web post
 * author avatar (round, unlike pets which use a rounded square).
 */
import { Image, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/theme";

function firstChar(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "🙂";
  return Array.from(trimmed)[0] ?? "🙂";
}

export function UserAvatar({
  name,
  photoURL,
  size = 40,
}: {
  name: string;
  photoURL?: string | null;
  size?: number;
}) {
  if (photoURL) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: photoURL }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.brandTint,
        }}
      />
    );
  }
  return (
    <View
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text
        style={{
          fontSize: Math.round(size * 0.44),
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
