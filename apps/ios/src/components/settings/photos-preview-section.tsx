/**
 * Settings → latest-photos preview — 1:1 with web photos-preview-section.
 * Header (🖼️ disc + 照片圖庫 + 查看全部) over a 3-up grid of the newest photos
 * (tap-through to the full gallery), or a dashed empty box. Reuses the same
 * aggregator the gallery screen uses; read-only.
 */
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { GalleryPhotoAsset } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { listMyPhotoAssetsWithStatus } from "@/lib/photo-gallery";
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const tS = scoped("Settings");
const tPv = scoped("Settings.photosPreview");
const PREVIEW = 3;

export function PhotosPreviewSection() {
  const router = useRouter();
  const { user } = useAuth();
  const { family } = useFamily();
  const [photos, setPhotos] = useState<GalleryPhotoAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listMyPhotoAssetsWithStatus(user.uid, family?.familyId ?? null)
      .then((r) => {
        if (!cancelled) setPhotos(r.assets.slice(0, PREVIEW));
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, family]);

  const open = () => router.push("/photos");

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconDisc}>
            <Text style={styles.iconText}>🖼️</Text>
          </View>
          <Text style={styles.title}>{tS("photosLink")}</Text>
        </View>
        <Pressable onPress={open} hitSlop={6} style={({ pressed }) => pressed && styles.dim}>
          <Text style={styles.viewAll}>{tPv("viewAll")}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.grid}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.cell, styles.cellSkeleton]} />
          ))}
        </View>
      ) : photos.length === 0 ? (
        <Pressable onPress={open} style={styles.empty}>
          <Text style={styles.emptyText}>{tPv("empty")}</Text>
        </Pressable>
      ) : (
        <View style={styles.grid}>
          {[0, 1, 2].map((i) => {
            const p = photos[i];
            return p ? (
              <Pressable
                key={p.id}
                onPress={open}
                accessibilityRole="imagebutton"
                accessibilityLabel={tS("photosLink")}
                style={styles.cell}
              >
                <Image source={{ uri: p.url }} style={styles.cellImg} />
              </Pressable>
            ) : (
              <View key={i} style={styles.cell} />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconDisc: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 16 },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  viewAll: { fontSize: 12, fontWeight: "700", color: colors.brandDeep },
  dim: { opacity: 0.6 },
  grid: { flexDirection: "row", gap: spacing.sm },
  cell: { flex: 1, aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.bgAlt },
  cellSkeleton: { opacity: 0.6 },
  cellImg: { width: "100%", height: "100%" },
  empty: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.hairline,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 14, color: colors.ink2 },
});
