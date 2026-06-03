/**
 * 7-day week strip (Monday-first). A day is "done" when its total walk minutes
 * reached the active pet's goal. S1 polish: done days fill with a paw mark
 * (brand, or leaf once today's goal is hit), today is ringed + labelled brand.
 * Mirrors web WalksWeekStrip.
 */
import { StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/theme/theme";

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

type Props = {
  days: boolean[]; // length 7, Monday-first
  todayIdx: number;
  complete: boolean;
};

export function WalksWeekStrip({ days, todayIdx, complete }: Props) {
  const doneColor = complete ? colors.leaf : colors.brand;
  return (
    <View style={styles.row}>
      {days.map((done, i) => {
        const isToday = i === todayIdx;
        return (
          <View key={i} style={styles.col}>
            <View
              style={[
                styles.dot,
                done && { backgroundColor: doneColor, borderColor: doneColor },
                isToday && !done && styles.dotToday,
              ]}
            >
              {done ? <Text style={styles.paw}>🐾</Text> : null}
            </View>
            <Text style={[styles.label, isToday && styles.labelToday]}>
              {DAY_LABELS[i]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  col: { alignItems: "center", gap: 6, flex: 1 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  dotToday: { borderColor: colors.brand },
  paw: { fontSize: 14 },
  label: { fontSize: 11, color: colors.ink3 },
  labelToday: { color: colors.brandDeep, fontWeight: "700" },
});
