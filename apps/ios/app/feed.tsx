/**
 * Full feed timeline — pushed from the home "查看更多" link. Same data as home
 * but uncapped (30 per source). 1:1 with web apps/web/src/app/app/feed/
 * page.tsx:
 *
 *  - RouteHeader: Nav.feed (26/800) + Feed.subtitle, then the full-width
 *    primary (btn-mango) PenSquare + Feed.compose button — hidden for guests,
 *    who get GuestLockedNotice("post") instead (web spec §C)
 *  - loading text → posts, or the Newspaper EmptyState (compose CTA for
 *    non-guests); a failed first load shows Error.title + retry
 *  - virtualised FlatList (cards — and their reaction reads / images — mount
 *    lazily as they scroll in); pull-to-refresh works in every state
 *
 * iOS: back row (stack navigation), the lightbox lives at screen level
 * (PostCard → onOpenPhotos) and offers save-to-Photos (PhotosKit extra).
 */
import { useCallback, useState, type ReactElement } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { AlertCircle, Newspaper, PenSquare, RefreshCw } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Post } from "@mango/shared-types";

import { useFeedData } from "@/lib/feed-data";
import { useAuth } from "@/state/auth-context";
import { GuestLockedNotice, GuestUpgradeNudge } from "@/components/auth/guest-upgrade";
import { Button, EmptyState, RouteHeader } from "@/components/ui";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { PhotoLightbox } from "@/components/feed/photo-lightbox";
import { savePhotoToAlbum } from "@/lib/save-photo";
import { alertError } from "@/lib/confirm";
import { t } from "@/lib/i18n";
import { colors, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isGuest } = useAuth();
  const {
    loading,
    refreshing,
    error,
    pets,
    posts,
    refresh,
    reloadAfterPost,
    removePost,
    removeBlockedAuthor,
  } = useFeedData({ home: false });
  const [composerOpen, setComposerOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);
  const currentUid = user?.uid ?? "";

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [router]);

  const openComposer = useCallback(() => setComposerOpen(true), []);
  const closeComposer = useCallback(() => setComposerOpen(false), []);
  const openPhotos = useCallback(
    (photos: string[], index: number) => setLightbox({ photos, index }),
    [],
  );
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const onRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const savePhoto = useCallback(async (url: string) => {
    try {
      await savePhotoToAlbum(url);
      Alert.alert(t("Common.saveToAlbum.saved"));
    } catch {
      alertError(t("Photos.status.failed"));
    }
  }, []);

  const renderItem = useCallback<ListRenderItem<Post>>(
    ({ item }) => (
      <PostCard
        post={item}
        currentUid={currentUid}
        onOpenPhotos={openPhotos}
        onDeleted={removePost}
        onBlocked={removeBlockedAuthor}
      />
    ),
    [currentUid, openPhotos, removePost, removeBlockedAuthor],
  );

  const header = (
    <View>
      {/* web: mb-6 flex flex-col gap-3 (title block + full-width compose) */}
      <View style={styles.headerBlock}>
        <RouteHeader
          title={t("Nav.feed")}
          subtitle={t("Feed.subtitle")}
          onBack={goBack}
          marginBottom={0}
        />
        {!isGuest ? (
          <Button
            label={t("Feed.compose")}
            icon={PenSquare}
            onPress={openComposer}
            size="md"
            fullWidth
          />
        ) : null}
      </View>
      <GuestUpgradeNudge />
      {isGuest ? <GuestLockedNotice feature="post" style={styles.locked} /> : null}
    </View>
  );

  let empty: ReactElement;
  if (loading) {
    empty = <Text style={styles.loading}>{t("Common.loading")}</Text>;
  } else if (error) {
    empty = (
      <EmptyState
        icon={AlertCircle}
        title={t("Error.title")}
        action={{ label: t("Error.retry"), onPress: onRefresh, icon: RefreshCw }}
      />
    );
  } else {
    empty = (
      <EmptyState
        icon={Newspaper}
        title={t("Feed.empty.title")}
        description={t("Feed.empty.subtitle")}
        action={
          isGuest
            ? undefined
            : { label: t("Feed.compose"), onPress: openComposer, icon: PenSquare }
        }
      />
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.postId}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      />

      <PostComposer
        visible={composerOpen && !isGuest}
        pets={pets}
        onClose={closeComposer}
        onPosted={reloadAfterPost}
      />

      {lightbox ? (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          open
          onClose={closeLightbox}
          onSave={savePhoto}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** web flex-col gap-3 between cards. */
function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  // web main: px-4 py-5; column capped + centred on iPad
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 20,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  headerBlock: { gap: spacing.md, marginBottom: spacing.xl },
  // web mb-6
  locked: { marginBottom: spacing.xl },
  // web text-sm text-zinc-500
  loading: { fontSize: 14, color: colors.ink3 },
  separator: { height: spacing.md },
});
