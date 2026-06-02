/**
 * Full feed timeline (P3a) — pushed from the home "查看更多" link. Same data as
 * home but uncapped. Mirrors apps/web/src/app/app/feed/page.tsx. Custom header
 * (back + title + compose) since the root stack hides native headers.
 */
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useFeedData } from "@/lib/feed-data";
import { useAuth } from "@/state/auth-context";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { loading, refreshing, pets, posts, refresh, removePost } = useFeedData({
    home: false,
  });
  const [composerOpen, setComposerOpen] = useState(false);

  const petNameById = useMemo(
    () => Object.fromEntries(pets.map((p) => [p.petId, p.name])),
    [pets],
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="返回"
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t("Home.feed.title")}</Text>
        <Pressable
          accessibilityLabel={t("Feed.compose")}
          onPress={() => setComposerOpen(true)}
          hitSlop={8}
          style={styles.composeBtn}
        >
          <Text style={styles.composeText}>＋</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t("Feed.empty.title")}</Text>
          <Text style={styles.emptyBody}>{t("Feed.empty.subtitle")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />
          }
        >
          {posts.map((p) => (
            <PostCard
              key={p.postId}
              post={p}
              currentUid={user?.uid ?? ""}
              petNameById={petNameById}
              onDeleted={() => removePost(p.postId)}
            />
          ))}
        </ScrollView>
      )}

      <PostComposer
        visible={composerOpen}
        pets={pets}
        onClose={() => setComposerOpen(false)}
        onPosted={refresh}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 30, color: colors.ink, fontWeight: "700", lineHeight: 32 },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  composeBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandTint,
    alignItems: "center", justifyContent: "center",
  },
  composeText: { fontSize: 22, color: colors.brandDeep, fontWeight: "900", lineHeight: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.ink2, textAlign: "center" },
  scroll: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
});
