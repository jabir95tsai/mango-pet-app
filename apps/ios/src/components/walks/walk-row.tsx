/**
 * Recent-walk row — 1:1 with apps/web/src/components/walks/walk-row.tsx:
 * card (radius 16, hairline, white, near-flat shadow), px 14 / py 12, gap 12.
 *
 *  - 40pt disc: manual → bg-alt + lucide Hand 18 ink2; GPS → brand-tint +
 *    inline paw 18 brand-deep
 *  - pet name 14/600 ink (truncated) + relative time 12 ink3 on one baseline
 *    (VoiceOver hint = exact "yyyy-MM-dd HH:mm", web `title`)
 *  - 12.5 ink2 row: Route 13 + km, Clock 13 + min, Star 12 + score (600
 *    brand-deep)
 *  - walker line: Avatar 18 + Walks.page.walkedBy, 11.5/500 ink3
 *  - optional 36pt photo thumb (radius 8, count badge for 2+) → lightbox
 *  - 32pt Trash2 16 ink3 delete (red while pressed, web hover)
 */
import { memo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Clock, Hand, Route, Star, Trash2 } from "lucide-react-native";
import type { Walk } from "@mango/shared-types";

import { Avatar } from "@/components/ui/Avatar";
import { PhotoLightbox } from "@/components/feed/photo-lightbox";
import { PawIcon } from "@/components/walks/paw-icon";
import { alertError } from "@/lib/confirm";
import { relativeTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { savePhotoToAlbum } from "@/lib/save-photo";
import { colors, radius, spacing } from "@/theme/theme";

function exactTime(walk: Walk): string {
  const ts = walk.startedAt as { toMillis?: () => number } | undefined;
  if (!ts?.toMillis) return "";
  const d = new Date(ts.toMillis());
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function WalkRowBase({ walk, onDelete }: { walk: Walk; onDelete: (walk: Walk) => void }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const photos = walk.photoURLs ?? [];
  const walkerName = walk.walkerName?.trim() || null;
  const rel = relativeTime(walk.startedAt as { toMillis?: () => number } | undefined);

  return (
    <View style={styles.row}>
      <View
        style={[styles.icon, walk.isManual ? styles.iconManual : styles.iconWalk]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {walk.isManual ? (
          <Hand size={18} color={colors.ink2} strokeWidth={2} />
        ) : (
          <PawIcon size={18} color={colors.brandDeep} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {walk.petName ?? "🐾"}
          </Text>
          <Text style={styles.rel} accessibilityHint={exactTime(walk)}>
            {rel}
          </Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Route size={13} color={colors.ink3} strokeWidth={2} />
            <Text style={styles.statText}>{`${(walk.distanceKm ?? 0).toFixed(2)} km`}</Text>
          </View>
          <View style={styles.stat}>
            <Clock size={13} color={colors.ink3} strokeWidth={2} />
            <Text style={styles.statText}>{`${(walk.durationMin ?? 0).toFixed(0)} min`}</Text>
          </View>
          <View style={styles.stat}>
            <Star size={12} color={colors.brandDeep} strokeWidth={2} />
            <Text style={[styles.statText, styles.score]}>{(walk.score ?? 0).toFixed(1)}</Text>
          </View>
        </View>
        {walkerName ? (
          <View style={styles.walker}>
            <Avatar
              name={walkerName}
              photoURL={walk.walkerPhotoURL}
              size={18}
              style={styles.walkerAvatar}
            />
            <Text style={styles.walkerText} numberOfLines={1}>
              {t("Walks.page.walkedBy", { name: walkerName })}
            </Text>
          </View>
        ) : null}
      </View>

      {photos.length > 0 ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={t("PhotoLightbox.counter", { current: 1, total: photos.length })}
          onPress={() => setLightboxOpen(true)}
          style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}
        >
          <Image
            source={{ uri: photos[0] }}
            style={styles.thumbImg}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          {photos.length > 1 ? (
            <View style={styles.thumbBadge}>
              <Text style={styles.thumbBadgeText}>{photos.length}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Common.delete")}
        onPress={() => onDelete(walk)}
        hitSlop={6}
        style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}
      >
        {({ pressed }) => (
          <Trash2 size={16} color={pressed ? colors.danger : colors.ink3} strokeWidth={2} />
        )}
      </Pressable>

      {lightboxOpen ? (
        <PhotoLightbox
          photos={photos}
          initialIndex={0}
          open
          onClose={() => setLightboxOpen(false)}
          onSave={async (url) => {
            try {
              await savePhotoToAlbum(url);
            } catch {
              alertError(t("Common.saveToAlbum.failed"));
            }
          }}
        />
      ) : null}
    </View>
  );
}

export const WalkRow = memo(WalkRowBase);

const styles = StyleSheet.create({
  // web: flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-3
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    // web: box-shadow 0 1px 0 rgba(0,0,0,0.02)
    shadowColor: "#000000",
    shadowOpacity: 0.02,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 1 },
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWalk: { backgroundColor: colors.brandTint },
  iconManual: { backgroundColor: colors.bgAlt },
  body: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  title: { flexShrink: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  rel: { flexShrink: 0, fontSize: 12, color: colors.ink3 },
  // web: mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] ink-2
  stats: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.md,
    rowGap: 2,
  },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12.5, color: colors.ink2, fontVariant: ["tabular-nums"] },
  score: { fontWeight: "600", color: colors.brandDeep },
  // web: mt-1.5 gap-1.5 text-[11.5px] font-medium ink-3
  walker: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  walkerAvatar: { borderWidth: 1, borderColor: colors.hairline },
  walkerText: { flexShrink: 1, fontSize: 11.5, fontWeight: "500", color: colors.ink3 },
  // web: size-9 rounded-lg border bg-bg-alt
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgAlt,
    overflow: "hidden",
  },
  thumbImg: { width: "100%", height: "100%" },
  // web: absolute right-0 bottom-0 h-4 min-w-4 rounded-tl-md bg-black/70 px-1 10px bold
  thumbBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    height: 16,
    minWidth: 16,
    paddingHorizontal: 4,
    borderTopLeftRadius: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
  },
  // web: grid size-8 rounded-lg ink-3, hover bg-red-50 text-red-600
  delete: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deletePressed: { backgroundColor: "#fef2f2" },
  pressed: { opacity: 0.85 },
});
