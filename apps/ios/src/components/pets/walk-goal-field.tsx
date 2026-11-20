/**
 * Per-pet daily walk-goal stepper with optional Gemini AI recommendation card,
 * matching apps/web/src/components/pets/pet-walk-goal-input.tsx and following
 * the Mango design system (theme tokens, Card, Pill, tabular-nums, and
 * useReducedMotion).
 */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Minus, Plus, Sparkles } from "lucide-react-native";
import {
  WALK_GOAL_MAX_MINUTES,
  WALK_GOAL_MIN_MINUTES,
  WALK_GOAL_STEP_MINUTES,
} from "@mango/shared-business";
import type { WalkGoalRecommendation } from "@mango/shared-types";

import { Card, FieldLabel, Pill } from "@/components/ui";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius, spacing } from "@/theme/theme";

type Props = {
  value: number;
  onChange: (next: number) => void;
  source: "manual" | "computed";
  onRequestRecommend: () => void;
  recommending: boolean;
  recommendation: WalkGoalRecommendation | null;
  recommendError: string | null;
  onApplyRecommendation: (minutes: number) => void;
  disabled?: boolean;
};

function clamp(n: number): number {
  if (!Number.isFinite(n)) return WALK_GOAL_MIN_MINUTES;
  return Math.min(
    WALK_GOAL_MAX_MINUTES,
    Math.max(WALK_GOAL_MIN_MINUTES, Math.round(n)),
  );
}

export function WalkGoalField({
  value,
  onChange,
  source,
  onRequestRecommend,
  recommending,
  recommendation,
  recommendError,
  onApplyRecommendation,
  disabled = false,
}: Props) {
  const reduceMotion = useReducedMotion();
  const safe = clamp(value);
  const atMin = safe <= WALK_GOAL_MIN_MINUTES;
  const atMax = safe >= WALK_GOAL_MAX_MINUTES;
  const label = t("PetEdit.walkGoal.label");
  const unit = t("PetEdit.walkGoal.unit");
  const decDisabled = disabled || atMin;
  const incDisabled = disabled || atMax;
  const aiDisabled = disabled || recommending;

  const dec = () => {
    if (!decDisabled) onChange(clamp(safe - WALK_GOAL_STEP_MINUTES));
  };
  const inc = () => {
    if (!incDisabled) onChange(clamp(safe + WALK_GOAL_STEP_MINUTES));
  };

  return (
    <View style={styles.field}>
      <View style={styles.headerRow}>
        <View style={styles.labelGroup}>
          <FieldLabel>{label}</FieldLabel>
          {source === "computed" ? (
            <Pill
              tone="leaf"
              label={t("PetEdit.walkGoal.computedChip")}
              style={styles.compactPill}
            />
          ) : null}
        </View>

        <Pressable
          onPress={onRequestRecommend}
          disabled={aiDisabled}
          hitSlop={{ top: 5, bottom: 5, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityState={{ disabled: aiDisabled, busy: recommending }}
          style={({ pressed }) => [
            styles.aiBtn,
            pressed && !aiDisabled && styles.aiBtnPressed,
            aiDisabled && styles.btnDisabled,
          ]}
        >
          {recommending ? (
            <>
              {reduceMotion ? (
                <Sparkles size={14} color={colors.brandDeep} strokeWidth={2} />
              ) : (
                <ActivityIndicator size="small" color={colors.brandDeep} />
              )}
              <Text style={styles.aiBtnText}>
                {t("PetEdit.walkGoal.aiSuggesting")}
              </Text>
            </>
          ) : (
            <>
              <Sparkles size={14} color={colors.brandDeep} strokeWidth={2} />
              <Text style={styles.aiBtnText}>
                {t("PetEdit.walkGoal.aiSuggest")}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.stepper}>
        <Pressable
          onPress={dec}
          disabled={decDisabled}
          hitSlop={2}
          style={({ pressed }) => [
            styles.stepBtn,
            pressed && !decDisabled && styles.stepBtnPressed,
            decDisabled && styles.stepBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`−${WALK_GOAL_STEP_MINUTES}`}
          accessibilityState={{ disabled: decDisabled }}
        >
          <Minus size={16} color={colors.ink2} strokeWidth={2} />
        </Pressable>

        <View
          style={styles.stepValueBox}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: `${safe} ${unit}` }}
          accessibilityActions={
            disabled ? undefined : [{ name: "increment" }, { name: "decrement" }]
          }
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "increment") inc();
            else if (e.nativeEvent.actionName === "decrement") dec();
          }}
        >
          <Text style={styles.stepValue}>{safe}</Text>
          <Text style={styles.stepUnit}>{unit}</Text>
        </View>

        <Pressable
          onPress={inc}
          disabled={incDisabled}
          hitSlop={2}
          style={({ pressed }) => [
            styles.stepBtn,
            pressed && !incDisabled && styles.stepBtnPressed,
            incDisabled && styles.stepBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`+${WALK_GOAL_STEP_MINUTES}`}
          accessibilityState={{ disabled: incDisabled }}
        >
          <Plus size={16} color={colors.ink2} strokeWidth={2} />
        </Pressable>
      </View>

      {recommendError ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {recommendError}
        </Text>
      ) : null}

      {recommendation ? (
        <Card tone="soft" padded={false} style={styles.recCard}>
          <View style={styles.recInner} accessibilityLiveRegion="polite">
            <View style={styles.recHeader}>
              <Text style={styles.recTitle}>
                {t("PetEdit.walkGoal.aiResultTitle", {
                  minutes: recommendation.minutes,
                  sessions: recommendation.sessionsPerDay,
                })}
              </Text>
              <Pill
                tone="brand"
                icon={Sparkles}
                label={t("PetEdit.walkGoal.aiBadge")}
                style={styles.compactPill}
              />
            </View>

            <Text style={styles.recBody}>{recommendation.rationale}</Text>

            {recommendation.tips.length > 0 ? (
              <View style={styles.tipList}>
                {recommendation.tips.map((tip, idx) => (
                  <View key={idx} style={styles.tipRow}>
                    <Text style={styles.tipBullet}>•</Text>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {safe !== recommendation.minutes ? (
              <Pressable
                onPress={() => onApplyRecommendation(recommendation.minutes)}
                disabled={disabled}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                style={({ pressed }) => [
                  styles.reapplyBtn,
                  pressed && !disabled && styles.reapplyBtnPressed,
                  disabled && styles.btnDisabled,
                ]}
              >
                <Text style={styles.reapplyText}>
                  {t("PetEdit.walkGoal.aiApplyAgain", {
                    minutes: recommendation.minutes,
                  })}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Card>
      ) : null}

      <Text style={styles.hint}>{t("PetEdit.walkGoal.hint")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  headerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  labelGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  compactPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.brandTint,
  },
  aiBtnPressed: { opacity: 0.85 },
  aiBtnText: { fontSize: 12, fontWeight: "700", color: colors.brandDeep },
  btnDisabled: { opacity: 0.6 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnPressed: { backgroundColor: colors.bgAlt },
  stepBtnDisabled: { opacity: 0.4 },
  stepValueBox: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    minWidth: 96,
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
  },
  stepValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    minWidth: 40,
    textAlign: "center",
  },
  stepUnit: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  errorText: { fontSize: 12, color: colors.danger },
  recCard: { borderRadius: radius.lg },
  recInner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  recHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  recTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  recBody: { fontSize: 12, lineHeight: 18, color: colors.ink2 },
  tipList: { gap: 2 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  tipBullet: { fontSize: 12, lineHeight: 18, color: colors.ink2 },
  tipText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.ink2 },
  reapplyBtn: {
    alignSelf: "flex-start",
    marginTop: 2,
    minHeight: 32,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  reapplyBtnPressed: { backgroundColor: colors.brandTint },
  reapplyText: { fontSize: 11, fontWeight: "700", color: colors.brandDeep },
  hint: { fontSize: 11, color: colors.ink3 },
});
