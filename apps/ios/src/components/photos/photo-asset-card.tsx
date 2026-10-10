/**
 * Gallery card — 1:1 with the web photos page card: white card (radius lg,
 * hairline, shadow-card) with a square image area carrying
 *   - top-left 44pt select circle (unselected: black/35 + white/80 ring;
 *     selected: brand fill + Check)
 *   - top-right 44pt Download circle (saves just this photo)
 *   - bottom-left source pill (black/55)
 *   - bottom-right "新" brand pill, or a white check disc once saved
 * and a footer: pet name / title, the title again (secondary), yyyy/MM/dd.
 */
import { memo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Download } from "lucide-react-native";
import type { GalleryPhotoAsset, GalleryPhotoSource } from "@mango/shared-types";

import { t } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";

const SOURCE_LABEL: Record<GalleryPhotoSource, string> = {
  post: "Photos.sources.post",
  walk: "Photos.sources.walk",
  "pet-avatar": "Photos.sources.petAvatar",
  "expense-receipt": "Photos.sources.expenseReceipt",
};

function dateText(asset: GalleryPhotoAsset): string {
  const ms = (asset.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? Date.now();
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

function PhotoAssetCardBase({
  asset,
  width,
  downloaded,
  selected,
  saving,
  onOpen,
  onToggleSelected,
  onSave,
}: {
  asset: GalleryPhotoAsset;
  width: number;
  downloaded: boolean;
  selected: boolean;
  saving: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
  onSave: () => void;
}) {
  const primary = asset.petName ?? asset.title;
  return (
    <View style={[styles.card, { width }]}>
      <View style={{ width, height: width }}>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={t("Photos.openPhoto", { title: asset.title })}
        onPress={onOpen}
        style={StyleSheet.absoluteFill}
      >
        <Image
          source={{ uri: asset.url }}
          style={styles.image}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </Pressable>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={selected ? t("Photos.deselect") : t("Photos.select")}
        accessibilityState={{ checked: selected }}
        onPress={onToggleSelected}
        style={[styles.circle, styles.select, selected ? styles.selectOn : styles.selectOff]}
      >
        {selected ? <Check size={20} color="#ffffff" strokeWidth={2.6} /> : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Photos.saveOne")}
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        onPress={onSave}
        style={({ pressed }) => [styles.circle, styles.download, (pressed || saving) && styles.dim]}
      >
        <Download size={20} color="#ffffff" strokeWidth={2} />
      </Pressable>

      <View style={styles.sourcePill} pointerEvents="none">
        <Text style={styles.sourceText}>{t(SOURCE_LABEL[asset.source])}</Text>
      </View>

      {downloaded ? (
        <View style={styles.savedDisc} accessible accessibilityLabel={t("Photos.downloaded")}>
          <Check size={16} color={colors.brandDeep} strokeWidth={2.6} />
        </View>
      ) : (
        <View style={styles.newPill} pointerEvents="none">
          <Text style={styles.newText}>{t("Photos.newBadge")}</Text>
        </View>
      )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.primary} numberOfLines={1}>
          {primary}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {asset.title}
        </Text>
        <Text style={styles.date}>{dateText(asset)}</Text>
      </View>
    </View>
  );
}

export const PhotoAssetCard = memo(PhotoAssetCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadows.card,
  },
  image: { width: "100%", height: "100%", backgroundColor: colors.bgAlt },
  circle: {
    position: "absolute",
    top: spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  select: { left: spacing.sm, borderWidth: 2 },
  selectOff: { backgroundColor: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.8)" },
  selectOn: { backgroundColor: colors.brand, borderColor: colors.brandDeep },
  download: { right: spacing.sm, backgroundColor: "rgba(0,0,0,0.45)" },
  dim: { opacity: 0.6 },
  sourcePill: {
    position: "absolute",
    left: spacing.sm,
    bottom: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sourceText: { fontSize: 11, fontWeight: "600", color: "#ffffff" },
  newPill: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  newText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
  savedDisc: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  // web: p-3 min-h-[84px]
  footer: { padding: spacing.md, minHeight: 84, gap: 2 },
  primary: { fontSize: 14, fontWeight: "600", color: colors.ink },
  secondary: { fontSize: 12, color: colors.ink2 },
  date: { fontSize: 12, color: colors.ink3 },
});
