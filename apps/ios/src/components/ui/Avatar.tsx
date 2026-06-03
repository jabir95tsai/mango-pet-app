/**
 * Avatar — unified photo-or-initial avatar (UX-0). Consolidates the two
 * near-identical implementations (pets used a rounded square, feed people used
 * a circle) behind one `shape` prop. The brand-tint disc with the first
 * grapheme (CJK / emoji safe) is the shared no-photo fallback.
 *
 * The legacy PetAvatar / UserAvatar wrappers stay as thin shims so existing
 * call sites keep working without a sweeping rename.
 */
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors } from "@/theme/theme";

export type AvatarShape = "circle" | "rounded";

/** First grapheme of the name (handles CJK + emoji surrogate pairs). */
function firstChar(name: string, fallback: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return fallback;
  return Array.from(trimmed)[0] ?? fallback;
}

export function Avatar({
  name,
  photoURL,
  size = 40,
  shape = "circle",
  fallbackChar = "🙂",
  style,
}: {
  name: string;
  photoURL?: string | null;
  size?: number;
  shape?: AvatarShape;
  fallbackChar?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const borderRadius = shape === "circle" ? size / 2 : Math.round(size * 0.34);

  if (photoURL) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: photoURL }}
        style={[
          { width: size, height: size, borderRadius, backgroundColor: colors.brandTint },
          style as StyleProp<ImageStyle>,
        ]}
      />
    );
  }
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius }, style]}>
      <Text style={{ fontSize: Math.round(size * 0.43), fontWeight: "800", color: colors.brandDeep }}>
        {firstChar(name, fallbackChar)}
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
