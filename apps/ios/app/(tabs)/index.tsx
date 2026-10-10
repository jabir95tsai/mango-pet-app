/**
 * Home v3 — feed-first + IG stories bar, 1:1 with apps/web/src/app/app/page.tsx
 * (and the app layout's guest nudge):
 *   load failure, 0 pets → top bar + error card + retry (never the hero)
 *   0 pets              → top bar + HomeEmptyState (add pet / join family)
 *   personal (no fam)   → stories + InviteFamilyCard + feed
 *   0 posts             → stories + NoPostsHint (opens the composer)
 *   ≥1 post             → stories + feed (10) + "查看更多動態" → /feed
 *
 * Data follows FamilyContext and refetches on focus when stale
 * (useFeedData → useScopedData); every variant is pull-to-refresh. Guests get
 * the upgrade nudge, and composer entry points open the upgrade sheet
 * instead (posting is guest-locked; PostCard gates reactions itself).
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AlertCircle, ChevronRight } from "lucide-react-native";

import { useFeedData } from "@/lib/feed-data";
import { resolveUserDisplayName, resolveUserPhotoURL } from "@/lib/auth-profile";
import { useAuth } from "@/state/auth-context";
import { GuestUpgradeNudge, useGuestUpgrade } from "@/components/auth/guest-upgrade";
import { EmptyState } from "@/components/ui/EmptyState";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { PhotoLightbox } from "@/components/feed/photo-lightbox";
import { savePhotoToAlbum } from "@/lib/save-photo";
import { HomeTopBar } from "@/components/home/home-top-bar";
import { StoriesBar } from "@/components/home/stories-bar";
import { FeedSectionHeader } from "@/components/home/feed-section-header";
import { HomeEmptyState } from "@/components/home/home-empty-state";
import { InviteFamilyCard } from "@/components/home/invite-family-card";
import { NoPostsHint } from "@/components/home/no-posts-hint";
import { t } from "@/lib/i18n";
import { colors, radius, shadows, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const { openUpgrade } = useGuestUpgrade();
  const {
    loading,
    refreshing,
    error,
    pets,
    posts,
    walkStatus,
    familyId,
    familyName,
    refresh,
    reloadAfterPost,
    removePost,
    removeBlockedAuthor,
  } = useFeedData({ home: true });
  const [composerOpen, setComposerOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const displayName = resolveUserDisplayName(user);
  // Story-slot initials still need *something* when there is no name.
  const storyName = displayName ?? user?.email?.split("@")[0] ?? "🙂";
  const isPersonal = familyId === null;

  // Posting is guest-locked — composer entry points open the upgrade sheet.
  const openComposer = () => (isGuest ? openUpgrade() : setComposerOpen(true));

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.brand} />
  );
  const topBar = (
    <HomeTopBar familyName={isPersonal ? null : familyName} userDisplayName={displayName} />
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  // Failed read with nothing cached → error + retry, never the 0-pet hero.
  if (error && pets.length === 0) {
    return (
      <SafeAreaView edges={["top"]} style={styles.flex}>
        {topBar}
        <ScrollView contentContainerStyle={[styles.scroll, styles.padded]} refreshControl={refreshControl}>
          <EmptyState
            icon={AlertCircle}
            title={t("Error.title")}
            action={{ label: t("Error.retry"), onPress: () => void refresh() }}
            style={styles.errorCard}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Variant: 0 pets → hero (with the same top bar, scrollable + refreshable)
  if (pets.length === 0) {
    return (
      <SafeAreaView edges={["top"]} style={styles.flex}>
        {topBar}
        <ScrollView contentContainerStyle={[styles.scroll, styles.padded]} refreshControl={refreshControl}>
          <HomeEmptyState
            onAddPet={() => router.push("/(tabs)/pets")}
            // web → /onboarding; on iOS the family screen hosts create + join.
            onJoinFamily={isGuest ? undefined : () => router.push("/family")}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      {topBar}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <GuestUpgradeNudge style={styles.nudge} />

        <StoriesBar
          pets={pets}
          walkStatus={walkStatus}
          userName={storyName}
          userPhotoURL={resolveUserPhotoURL(user)}
          onComposerOpen={openComposer}
        />

        <View style={styles.padded}>
          {isPersonal && !isGuest ? (
            <InviteFamilyCard petName={pets[0]?.name} onInvite={() => router.push("/family")} />
          ) : null}

          <FeedSectionHeader onViewAll={() => router.push("/feed")} />

          {posts.length === 0 ? (
            <NoPostsHint onCompose={openComposer} />
          ) : (
            <>
              <View style={styles.feed}>
                {posts.map((p) => (
                  <PostCard
                    key={p.postId}
                    post={p}
                    currentUid={user?.uid ?? ""}
                    onOpenPhotos={(photos, index) => setLightbox({ photos, index })}
                    onDeleted={() => removePost(p.postId)}
                    onBlocked={removeBlockedAuthor}
                  />
                ))}
              </View>
              {/* Even at exactly 10 posts there may be more behind (web). */}
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push("/feed")}
                style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
              >
                <Text style={styles.moreText}>{t("Home.feed.viewAllLong")}</Text>
                <ChevronRight size={14} color={colors.brandDeep} strokeWidth={2.4} />
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <PostComposer
        visible={composerOpen}
        pets={pets}
        onClose={() => setComposerOpen(false)}
        onPosted={reloadAfterPost}
      />

      {lightbox ? (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          open
          onClose={() => setLightbox(null)}
          onSave={async (url) => {
            try {
              await savePhotoToAlbum(url);
              Alert.alert(t("Photos.status.saved", { count: 1 }));
            } catch {
              Alert.alert(t("Photos.status.failed"));
            }
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  scroll: {
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  padded: { paddingHorizontal: spacing.lg },
  nudge: { marginHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.sm },
  errorCard: { marginTop: spacing.xl },
  // web: flex flex-col gap-3
  feed: { gap: spacing.md },
  // web: mt-4 w-full rounded-full border bg-card px-5 py-3 text-[13px] extrabold shadow-card
  more: {
    marginTop: spacing.lg,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  morePressed: { backgroundColor: colors.bgAlt },
  moreText: { fontSize: 13, fontWeight: "800", color: colors.brandDeep },
});
