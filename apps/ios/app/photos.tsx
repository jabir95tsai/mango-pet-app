/**
 * Photos gallery — 1:1 with apps/web/src/app/app/photos/page.tsx:
 * back row → RouteHeader (title + "共 N 張 · M 張尚未儲存") → a full-width
 * primary "儲存 M 張尚未下載的照片" / "全部已儲存" and, with a selection, a
 * secondary "儲存選取的 N 張" → partial-error / status banners → filter pills
 * (solid brand when active) → a virtualized 2-column grid of PhotoAssetCards
 * (select, per-photo save, source pill, new / saved badge, footer) → tap
 * opens the lightbox (only current ±1 decoded).
 *
 * Saving asks Photos permission once per batch (denial offers iOS
 * Settings), downloads the original bytes, records users/{uid}/
 * photoDownloadState, keeps failed items selected, and gates every save
 * control (incl. the lightbox) while a batch runs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowLeft, Camera, Download, Images } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { GalleryPhotoAsset, GalleryPhotoSource } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { useFamilyScope } from "@/lib/use-family-scope";
import {
  listDownloadedPhotoAssetIds,
  listMyPhotoAssetsWithStatus,
  markPhotoAssetsDownloaded,
  type PhotoGallerySourceKey,
} from "@/lib/photo-gallery";
import { ensureAddPermission, savePhotoToAlbum } from "@/lib/save-photo";
import { PhotoLightbox } from "@/components/feed/photo-lightbox";
import { PhotoAssetCard } from "@/components/photos/photo-asset-card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import { colors, radius, spacing, type, CONTENT_MAX_WIDTH } from "@/theme/theme";

type FilterKey = "all" | GalleryPhotoSource;
const FILTERS: FilterKey[] = ["all", "post", "walk", "pet-avatar", "expense-receipt"];
const FILTER_LABEL: Record<FilterKey, string> = {
  all: "Photos.filters.all",
  post: "Photos.filters.post",
  walk: "Photos.filters.walk",
  "pet-avatar": "Photos.filters.petAvatar",
  "expense-receipt": "Photos.filters.expenseReceipt",
};
const ALL_SOURCES: PhotoGallerySourceKey[] = ["posts", "walks", "pets", "expenses"];
const GAP = spacing.md;

export default function PhotosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  const cellW = Math.floor((width - spacing.lg * 2 - GAP) / 2);

  const [assets, setAssets] = useState<GalleryPhotoAsset[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [failedSources, setFailedSources] = useState<PhotoGallerySourceKey[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const savingRef = useRef(false);

  // Scope from FamilyContext (R08): waits for it, reloads when it changes.
  const { familyId, scopeReady, status: scopeStatus } = useFamilyScope();
  const loadGen = useRef(0);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!user || !scopeReady) return;
      const gen = ++loadGen.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const [galleryR, dlR] = await Promise.allSettled([
        listMyPhotoAssetsWithStatus(user.uid, familyId),
        listDownloadedPhotoAssetIds(user.uid),
      ]);
      if (gen !== loadGen.current) return; // superseded (scope changed)
      if (galleryR.status === "fulfilled") {
        setAssets(galleryR.value.assets);
        setFailedSources(galleryR.value.failedSources);
      } else {
        setAssets([]);
        setFailedSources(ALL_SOURCES);
      }
      if (dlR.status === "fulfilled") setDownloadedIds(dlR.value);
      setRefreshing(false);
      setLoading(false);
    },
    [user, familyId, scopeReady],
  );

  useEffect(() => {
    if (scopeStatus === "error") {
      setFailedSources(ALL_SOURCES);
      setLoading(false);
      return;
    }
    void load(false);
  }, [load, scopeStatus]);

  const filtered = useMemo(
    () => (filter === "all" ? assets : assets.filter((a) => a.source === filter)),
    [assets, filter],
  );
  const undownloaded = useMemo(
    () => assets.filter((a) => !downloadedIds.has(a.id)),
    [assets, downloadedIds],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const saveAssets = useCallback(
    async (targets: GalleryPhotoAsset[]): Promise<boolean> => {
      if (!user || targets.length === 0 || savingRef.current) return false;
      savingRef.current = true;
      setSaving(true);
      setStatus(null);
      try {
        if (!(await ensureAddPermission())) {
          setStatus(t("Photos.status.failed"));
          Alert.alert(t("Photos.status.failed"), t("Common.saveToAlbum.permissionDenied"), [
            { text: t("Common.cancel"), style: "cancel" },
            { text: t("Push.openIosSettings"), onPress: () => void Linking.openSettings() },
          ]);
          return false;
        }
        const done: GalleryPhotoAsset[] = [];
        let failed = 0;
        for (const a of targets) {
          try {
            await savePhotoToAlbum(a.url, { skipPermission: true });
            done.push(a);
          } catch {
            failed++;
          }
        }
        if (done.length > 0) {
          await markPhotoAssetsDownloaded(user.uid, done, "download").catch(() => {});
          setDownloadedIds((prev) => {
            const next = new Set(prev);
            done.forEach((a) => next.add(a.id));
            return next;
          });
          // Only completed ones leave the selection; failures stay selected.
          setSelected((prev) => {
            const next = new Set(prev);
            done.forEach((a) => next.delete(a.id));
            return next;
          });
        }
        setStatus(
          done.length === 0
            ? t("Photos.status.failed")
            : failed > 0
              ? t("Photos.status.partial", { count: done.length })
              : t("Photos.status.saved", { count: done.length }),
        );
        return failed === 0;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [user],
  );

  const header = (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Common.back")}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/settings"))}
        hitSlop={8}
        style={styles.backBtn}
      >
        <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        {t("Photos.title")}
      </Text>
      <Text style={styles.subtitle}>
        {t("Photos.subtitle", { total: assets.length, remaining: undownloaded.length })}
      </Text>

      <View style={styles.actions}>
        <Button
          fullWidth
          icon={<Download size={16} color="#ffffff" strokeWidth={2} />}
          label={
            saving
              ? t("Photos.actions.saving")
              : undownloaded.length === 0
                ? t("Photos.actions.allSaved")
                : t("Photos.actions.saveRemaining", { count: undownloaded.length })
          }
          disabled={saving || undownloaded.length === 0}
          onPress={() => void saveAssets(undownloaded)}
        />
        {selected.size > 0 ? (
          <Button
            fullWidth
            variant="secondary"
            icon={<Download size={16} color={colors.ink} strokeWidth={2} />}
            label={t("Photos.actions.saveSelected", { count: selected.size })}
            disabled={saving}
            onPress={() => void saveAssets(assets.filter((a) => selected.has(a.id)))}
          />
        ) : null}
      </View>

      {failedSources.length > 0 ? (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Text style={styles.bannerText}>{t("Photos.partialError")}</Text>
        </View>
      ) : null}
      {status ? (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Text style={[styles.bannerText, styles.bannerMuted]}>{status}</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}
        style={styles.pillsWrap}
      >
        {FILTERS.map((f) => {
          const on = filter === f;
          return (
            <Pressable
              key={f}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(f)}
              style={[styles.pill, on && styles.pillOn]}
            >
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{t(FILTER_LABEL[f])}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const empty = loading ? (
    <ActivityIndicator color={colors.brand} size="large" style={styles.loader} />
  ) : assets.length === 0 ? (
    <EmptyState
      icon={Images}
      title={t("Photos.empty.title")}
      description={t("Photos.empty.description")}
      action={
        <View style={styles.emptyActions}>
          <Button
            label={t("Photos.empty.feedCta")}
            icon={<Camera size={16} color="#ffffff" strokeWidth={2} />}
            onPress={() => router.push("/feed")}
          />
          <Button
            label={t("Photos.empty.walkCta")}
            variant="secondary"
            onPress={() => router.push("/(tabs)/walks")}
          />
        </View>
      }
    />
  ) : (
    <EmptyState
      icon={Images}
      title={t("Photos.emptyFilter.title")}
      description={t("Photos.emptyFilter.description")}
    />
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={(a) => a.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        initialNumToRender={8}
        windowSize={5}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brand} />
        }
        renderItem={({ item, index }) => (
          <PhotoAssetCard
            asset={item}
            width={cellW}
            downloaded={downloadedIds.has(item.id)}
            selected={selected.has(item.id)}
            saving={saving}
            onOpen={() => setLightboxIdx(index)}
            onToggleSelected={() => toggleSelect(item.id)}
            onSave={() => void saveAssets([item])}
          />
        )}
      />

      {lightboxIdx !== null ? (
        <PhotoLightbox
          photos={filtered.map((a) => a.url)}
          initialIndex={lightboxIdx}
          open
          onClose={() => setLightboxIdx(null)}
          saving={saving}
          onSave={async (_url, i) => {
            const asset = filtered[i];
            if (asset) await saveAssets([asset]);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: GAP,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  column: { gap: GAP },
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  title: { ...type.h1, color: colors.ink },
  subtitle: { marginTop: 4, fontSize: 14, lineHeight: 24, color: colors.ink2 },
  actions: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.lg },
  banner: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.cardSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  bannerWarn: { borderColor: colors.bellTint },
  bannerText: { fontSize: 14, color: colors.ink },
  bannerMuted: { color: colors.ink2 },
  pillsWrap: { flexGrow: 0, marginBottom: spacing.lg },
  pills: { gap: spacing.sm },
  // web: h-10 px-4 rounded-full border text-sm font-semibold
  pill: {
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    justifyContent: "center",
  },
  pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
  pillTextOn: { color: "#ffffff" },
  loader: { marginTop: spacing.xl },
  emptyActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
});
