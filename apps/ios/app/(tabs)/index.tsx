/**
 * Home v3 (P3a) — feed-first + IG stories bar. Four variants, mirroring web
 * apps/web/src/app/app/page.tsx:
 *   0 pets            → HomeEmptyState (CTA → pets tab)
 *   personal (no fam) → StoriesBar + InviteFamilyCard + feed
 *   family, 0 posts   → StoriesBar + "no posts" hint
 *   family, ≥1 post   → StoriesBar + feed (10) + "view all" → /feed
 */
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { HomeTopBar } from "@/components/home/home-top-bar";
import { StoriesBar } from "@/components/home/stories-bar";
import { FeedSectionHeader } from "@/components/home/feed-section-header";
import { HomeEmptyState } from "@/components/home/home-empty-state";
import { InviteFamilyCard } from "@/components/home/invite-family-card";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    loading,
    refreshing,
    pets,
    posts,
    walkStatus,
    familyId,
    familyName,
    refresh,
    removePost,
  } = useFeedData({ home: true });
  const [composerOpen, setComposerOpen] = useState(false);

  const petNameById = useMemo(
    () => Object.fromEntries(pets.map((p) => [p.petId, p.name])),
    [pets],
  );
  const userName =
    user?.displayName ?? user?.email?.split("@")[0] ?? "Friend";
  const isPersonal = familyId === null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  // Variant: 0 pets → full hero
  if (pets.length === 0) {
    return (
      <SafeAreaView edges={["top"]} style={styles.flex}>
        <HomeEmptyState onAddPet={() => router.push("/(tabs)/pets")} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <HomeTopBar
        familyName={isPersonal ? null : familyName}
        userDisplayName={userName}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />
        }
      >
        <StoriesBar
          pets={pets}
          walkStatus={walkStatus}
          userName={userName}
          userPhotoURL={user?.photoURL}
          onComposerOpen={() => setComposerOpen(true)}
        />

        {isPersonal ? (
          <InviteFamilyCard
            petName={pets[0]?.name}
            onInvite={() => router.push("/(tabs)/settings")}
          />
        ) : null}

        <FeedSectionHeader
          onViewAll={posts.length > 0 ? () => router.push("/feed") : undefined}
        />

        {posts.length === 0 ? (
          <View style={styles.hint}>
            <Text style={styles.hintTitle}>{t("Home.feed.emptyTitle")}</Text>
            <Text style={styles.hintBody}>{t("Home.feed.emptyHint")}</Text>
          </View>
        ) : (
          <View style={styles.feed}>
            {posts.map((p) => (
              <PostCard
                key={p.postId}
                post={p}
                currentUid={user?.uid ?? ""}
                petNameById={petNameById}
                onDeleted={() => removePost(p.postId)}
              />
            ))}
          </View>
        )}
      </ScrollView>

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
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxl },
  feed: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  hint: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.xl,
    borderRadius: 16,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    gap: spacing.xs,
  },
  hintTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  hintBody: { fontSize: 13, color: colors.ink2, textAlign: "center" },
});
