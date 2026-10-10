/**
 * Seven-day strip — 1:1 with apps/web/src/components/walks/walks-week-strip.tsx.
 * Card container (rounded-2xl, hairline, shadow-card). Per day a 34px circle:
 *   done       → solid brand fill, white paw
 *   done+today → solid leaf fill, white paw, leaf-tint halo ring
 *   today      → brand-tint fill, solid brand border, brand dot
 *   other      → dashed hairline border, empty
 */
import { StyleSheet, Text, View } from "react-native";

import { PawIcon } from "@/components/walks/paw-icon";
import { useLocale } from "@/lib/i18n";
import { colors, shadows, spacing } from "@/theme/theme";

/** web date-fns format(day, "EEEEE") — narrow weekday, Monday first. */
const DAY_LABELS: Record<string, string[]> = {
  "zh-TW": ["一", "二", "三", "四", "五", "六", "日"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
};

type Props = {
  days: boolean[]; // length 7, Monday-first
  todayIdx: number;
  complete: boolean;
};

export function WalksWeekStrip({ days, todayIdx, complete }: Props) {
  const locale = useLocale();
  const labels = DAY_LABELS[locale] ?? DAY_LABELS.en;
  return (
    <View style={styles.card}>
      {days.map((done, i) => {
        const isToday = i === todayIdx;
        const todayDone = isToday && complete;
        return (
          <View key={i} style={styles.col}>
            <Text style={[styles.label, isToday && styles.labelToday]}>
              {labels[i]}
            </Text>
            {/* web: done-today halo = box-shadow 0 0 0 3px leaf-tint OUTSIDE */}
            <View style={[styles.haloWrap, todayDone && styles.halo]}>
              <View
                style={[
                  styles.dot,
                  done
                    ? todayDone
                      ? styles.dotLeaf
                      : styles.dotBrand
                    : isToday
                      ? styles.dotToday
                      : styles.dotEmpty,
                ]}
              >
                {done ? (
                  <PawIcon size={16} />
                ) : isToday ? (
                  <View style={styles.todayDot} />
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    // web rounded-2xl = 16 (radius tokens are not in Tailwind @theme)
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...shadows.card,
  },
  col: { alignItems: "center", gap: 6, flex: 1 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, color: colors.ink3 },
  labelToday: { color: colors.brandDeep },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dotBrand: { backgroundColor: colors.brand },
  dotLeaf: { backgroundColor: colors.leaf },
  dotToday: {
    backgroundColor: colors.brandTint,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  dotEmpty: {
    borderWidth: 1.5,
    borderColor: colors.hairline,
    borderStyle: "dashed",
  },
  // 40pt ring with -3 margins: the halo never changes the 34pt layout box.
  haloWrap: {
    width: 40,
    height: 40,
    margin: -3,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: { backgroundColor: colors.leafTint },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
});
