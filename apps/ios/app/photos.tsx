/**
 * Photos gallery (P3c) — mirrors apps/web/src/app/app/photos/page.tsx. Filter
 * pills (all / post / walk / pet-avatar / expense-receipt), a 2-col grid with a
 * per-cell select checkbox + saved badge, batch "save selected", tap → lightbox
 * (with per-photo save). Save uses PhotosKit (save-photo.ts, native-upgrade);
 * saved assets are recorded in users/{uid}/photoDownloadState.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type {
  GalleryPhotoAsset,
  GalleryPhotoSource,
} from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { resolveCurrentFamilyId } from "@/lib/walk-data";
import {
  listDownloadedPhotoAssetIds,
  listMyPhotoAssetsWithStatus,
  markPhotoAssetsDownloaded,
} from "@/lib/photo-gallery";
import { savePhotoToAlbum } from "@/lib/save-photo";
import { PhotoLightbox } from "@/components/feed/photo-lightbox";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

type FilterKey = "all" | GalleryPhotoSource;
const FILTERS: FilterKey[] = ["all", "post", "walk", "pet-avatar", "expense-receipt"];

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "Photos.filters.all",
  post: "Photos.filters.post",
  walk: "Photos.filters.walk",
  "pet-avatar": "Photos.filters.petAvatar",
  "expense-receipt": "Photos.filters.expenseReceipt",
};
const SOURCE_LABEL: Record<GalleryPhotoSource, string> = {
  post: "Photos.sources.post",
  walk: "Photos.sources.walk",
  "pet-avatar": "Photos.sources.petAvatar",
  "expense-receipt": "Photos.sources.expenseReceipt",
};

export default function PhotosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [assets, setAssets] = useState<GalleryPhotoAsset[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const fam = await resolveCurrentFamilyId(user.uid);
        const [{ assets: list }, dl] = await Promise.all([
          listMyPhotoAssetsWithStatus(user.uid, fam),
          listDownloadedPhotoAssetIds(user.uid),
        ]);
        setAssets(list);
        setDownloadedIds(dl);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const filtered = useMemo(
    () => (filter === "all" ? assets : assets.filter((a) => a.source === filter)),
    [assets, filter],
  );
  const remaining = useMemo(
    () => assets.filter((a) => !downloadedIds.has(a.id)).length,
    [assets, downloadedIds],
  );

  const gap = spacing.sm;
  const cols = 2;
  const cellW = Math.floor((width - spacing.lg * 2 - gap * (cols - 1)) / cols);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveSelected() {
    if (!user || selected.size === 0 || saving) return;
    setSaving(true);
    setStatus(null);
    const toSave = assets.filter((a) => selected.has(a.id));
    const done: GalleryPhotoAsset[] = [];
    let failed = 0;
    for (const a of toSave) {
      try {
        await savePhotoToAlbum(a.url);
        done.push(a);
      } catch {
        failed++;
      }
    }
    if (done.length > 0) {
      try {
        await markPhotoAssetsDownloaded(user.uid, done, "download");
      } catch {
        // best-effort; saved to album regardless
      }
      setDownloadedIds((prev) => {
        const next = new Set(prev);
        done.forEach((a) => next.add(a.id));
        return next;
      });
    }
    setSelected(new Set());
    setSaving(false);
    setStatus(
      failed > 0
        ? t("Photos.status.partial", { count: done.length })
        : t("Photos.status.saved", { count: done.length }),
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.flex}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="返回" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t("Photos.title")}</Text>
          <Text style={styles.subtitle}>
            {t("Photos.subtitle", { total: assets.length, remaining })}
          </Text>
        </View>
      </View>

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
              onPress={() => setFilter(f)}
              style={[styles.pill, on && styles.pillOn]}
            >
              <Text style={[styles.pillText, on && styles.pillTextOn]}>
                {t(FILTER_LABEL[f])}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t("Photos.empty.title")}</Text>
          <Text style={styles.emptyBody}>{t("Photos.empty.description")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.grid, { gap }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand} />
          }
        >
          {filtered.map((a, i) => {
            const isSel = selected.has(a.id);
            const isDl = downloadedIds.has(a.id);
            return (
              <Pressable
                key={a.id}
                accessibilityLabel={t("Photos.openPhoto", { title: a.title })}
                onPress={() => setLightboxIdx(i)}
                style={{ width: cellW }}
              >
                <Image
                  source={{ uri: a.url }}
                  style={{ width: cellW, height: cellW, borderRadius: radius.md, backgroundColor: colors.bgAlt }}
                />
                <Pressable
                  accessibilityLabel={isSel ? t("Photos.deselect") : t("Photos.select")}
                  onPress={() => toggleSelect(a.id)}
                  hitSlop={8}
                  style={[styles.checkbox, isSel && styles.checkboxOn]}
                >
                  {isSel ? <Text style={styles.checkMark}>✓</Text> : null}
                </Pressable>
                <View style={styles.srcBadge}>
                  <Text style={styles.srcText}>{t(SOURCE_LABEL[a.source])}</Text>
                </View>
                {isDl ? (
                  <View style={styles.dlBadge}>
                    <Text style={styles.dlText}>{t("Photos.downloaded")}</Text>
                  </View>
                ) : (
                  <View style={[styles.dlBadge, styles.newBadge]}>
                    <Text style={styles.dlText}>{t("Photos.newBadge")}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {status ? <Text style={styles.statusBar}>{status}</Text> : null}

      {selected.size > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={saveSelected}
          disabled={saving}
          style={({ pressed }) => [styles.saveBar, pressed && styles.pressed]}
        >
          {saving ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.saveBarText}>
              {t("Photos.actions.saveSelected", { count: selected.size })}
            </Text>
          )}
        </Pressable>
      ) : null}

      {lightboxIdx !== null ? (
        <PhotoLightbox
          photos={filtered.map((a) => a.url)}
          initialIndex={lightboxIdx}
          open
          onClose={() => setLightboxIdx(null)}
          saving={saving}
          onSave={async (url) => {
            if (!user) return;
            const asset = filtered.find((a) => a.url === url);
            try {
              await savePhotoToAlbum(url);
              if (asset) {
                await markPhotoAssetsDownloaded(user.uid, [asset], "download").catch(() => {});
                setDownloadedIds((prev) => new Set(prev).add(asset.id));
              }
              setStatus(t("Photos.status.saved", { count: 1 }));
            } catch {
              setStatus(t("Photos.status.failed"));
            }
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 30, color: colors.ink, fontWeight: "700", lineHeight: 32 },
  headerText: { flex: 1, marginLeft: spacing.xs },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 12, color: colors.ink3 },
  pillsWrap: { maxHeight: 52, flexGrow: 0 },
  pills: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, justifyContent: "center",
    backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.hairline,
  },
  pillOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  pillText: { fontSize: 13, fontWeight: "600", color: colors.ink2 },
  pillTextOn: { color: colors.brandDeep, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.ink2, textAlign: "center", lineHeight: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, paddingBottom: 96 },
  checkbox: {
    position: "absolute", top: 6, left: 6, width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: "#fff", backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.card },
  checkMark: { color: "#fff", fontSize: 14, fontWeight: "900" },
  srcBadge: {
    position: "absolute", bottom: 6, left: 6, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.55)",
  },
  srcText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  dlBadge: {
    position: "absolute", top: 6, right: 6, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radius.pill, backgroundColor: colors.leaf,
  },
  newBadge: { backgroundColor: colors.brand },
  dlText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  statusBar: { textAlign: "center", fontSize: 12, color: colors.ink2, paddingVertical: spacing.xs },
  saveBar: {
    position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.xl, height: 52,
    borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
    shadowColor: colors.brandDeep, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  saveBarText: { color: colors.card, fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.85 },
});
