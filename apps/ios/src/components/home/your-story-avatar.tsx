/**
 * "Your story" slot (P3a) — first item in the StoriesBar. A circular user
 * avatar with a dashed brand ring + a small brand disc with a white "+" at the
 * bottom-right; tapping opens the PostComposer (IG-style entry, web D2). Mirrors
 * apps/web/src/components/home/your-story-avatar.tsx.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { UserAvatar } from "@/components/feed/user-avatar";
import { t } from "@/lib/i18n";
import { colors } from "@/theme/theme";

const SIZE = 64;

export function YourStoryAvatar({
  name,
  photoURL,
  onPress,
}: {
  name: string;
  photoURL?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("Home.stories.yourStory")}
      onPress={onPress}
      style={styles.wrap}
    >
      <View style={styles.ring}>
        <UserAvatar name={name} photoURL={photoURL} size={SIZE - 8} />
        <View style={styles.plus}>
          <Text style={styles.plusText}>＋</Text>
        </View>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {t("Home.stories.yourStory")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: SIZE + 12 },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  plus: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  plusText: { color: colors.card, fontSize: 13, fontWeight: "900", lineHeight: 15 },
  label: { marginTop: 4, fontSize: 11, fontWeight: "600", color: colors.ink2 },
});
