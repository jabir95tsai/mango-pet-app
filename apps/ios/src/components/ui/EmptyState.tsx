/**
 * EmptyState — the shared "nothing here yet" surface.
 *
 * variant="card" (default when an `icon` is given) is 1:1 with web
 * apps/web/src/components/ui/empty-state.tsx: a dashed hairline card on
 * white/75, px-6 py-12, centred column gap-3; a 48pt brandTint tile holding a
 * 24pt brandDeep lucide icon; title 16/600 ink; description 14 ink2 capped at
 * max-w-sm (384); then the action (web passes a md primary <Button>).
 * variant="plain" is the same column without the card chrome.
 *
 * variant="hero" is the legacy UX-0 look (big emoji or mango gradient disc,
 * 20/800 title, flex-1 centred) kept for existing callers that only pass
 * `emoji` (+ `gradientHero`, `hint`). Legacy props `body`, `ctaLabel` and
 * `onPressCta` still work in every variant.
 *
 * `action` takes either a descriptor `{ label, onPress, icon? }` (rendered as a
 * primary md Button, like web) or any ReactNode for bespoke CTAs.
 */
import { isValidElement, type ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { Button, type ButtonVariant } from "./Button";
import { colors, mangoGradient, radius, spacing, type } from "@/theme/theme";

export type EmptyStateAction = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  accessibilityLabel?: string;
  loading?: boolean;
  disabled?: boolean;
};

export type EmptyStateVariant = "card" | "plain" | "hero";

export type EmptyStateProps = {
  /** Lucide icon shown in the 48pt tinted tile (web `icon`). */
  icon?: LucideIcon;
  /** Legacy hero glyph; in card/plain variants it fills the tile when no `icon`. */
  emoji?: string;
  title: string;
  /** Web `description`. */
  description?: string;
  /** Legacy alias of `description`. */
  body?: string;
  action?: EmptyStateAction | ReactNode;
  secondaryAction?: EmptyStateAction;
  /** Legacy CTA (same as `action={{ label: ctaLabel, onPress: onPressCta }}`). */
  ctaLabel?: string;
  onPressCta?: () => void;
  /** Legacy hero only: mango gradient disc behind the emoji. */
  gradientHero?: boolean;
  /** Small ink3 footnote under the actions. */
  hint?: string;
  variant?: EmptyStateVariant;
  style?: StyleProp<ViewStyle>;
};

function isActionDescriptor(a: unknown): a is EmptyStateAction {
  return (
    a != null &&
    typeof a === "object" &&
    !isValidElement(a) &&
    "label" in (a as object) &&
    "onPress" in (a as object)
  );
}

function ActionButton({
  action,
  variant,
  hero,
}: {
  action: EmptyStateAction;
  variant: ButtonVariant;
  hero: boolean;
}) {
  return (
    <Button
      label={action.label}
      onPress={action.onPress}
      icon={action.icon}
      variant={variant}
      size={hero ? "lg" : "md"}
      pill={hero}
      loading={action.loading}
      disabled={action.disabled}
      accessibilityLabel={action.accessibilityLabel}
      labelStyle={hero && variant === "primary" ? styles.heroCtaLabel : undefined}
    />
  );
}

export function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  body,
  action,
  secondaryAction,
  ctaLabel,
  onPressCta,
  gradientHero = false,
  hint,
  variant,
  style,
}: EmptyStateProps) {
  const kind: EmptyStateVariant =
    variant ?? (Icon || !emoji || action != null ? "card" : "hero");
  const hero = kind === "hero";
  const text = description ?? body;

  const primary: EmptyStateAction | ReactNode =
    action ?? (ctaLabel && onPressCta ? { label: ctaLabel, onPress: onPressCta } : null);

  const primaryNode = isActionDescriptor(primary) ? (
    <ActionButton action={primary} variant="primary" hero={hero} />
  ) : (
    (primary as ReactNode)
  );

  const actions =
    primaryNode != null || secondaryAction ? (
      <View style={[styles.actions, hero && styles.actionsHero]}>
        {primaryNode}
        {secondaryAction ? (
          <ActionButton action={secondaryAction} variant="secondary" hero={hero} />
        ) : null}
      </View>
    ) : null;

  if (hero) {
    return (
      <View style={[styles.heroBox, style]}>
        {Icon ? (
          <View style={styles.heroIconDisc}>
            <Icon size={44} color={colors.brandDeep} strokeWidth={2} />
          </View>
        ) : gradientHero ? (
          <LinearGradient
            colors={mangoGradient.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroDisc}
          >
            <Text style={styles.heroDiscEmoji}>{emoji}</Text>
          </LinearGradient>
        ) : emoji ? (
          <Text style={styles.heroEmoji}>{emoji}</Text>
        ) : null}
        <Text style={styles.heroTitle} accessibilityRole="header">
          {title}
        </Text>
        {text ? <Text style={styles.heroBody}>{text}</Text> : null}
        {actions}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.column, kind === "card" && styles.card, style]}>
      {Icon || emoji ? (
        <View style={styles.tile} accessible={false} importantForAccessibility="no-hide-descendants">
          {Icon ? (
            <Icon size={24} color={colors.brandDeep} strokeWidth={2} />
          ) : (
            <Text style={styles.tileEmoji}>{emoji}</Text>
          )}
        </View>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {text ? <Text style={styles.description}>{text}</Text> : null}
      {actions}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── web ui/empty-state ──
  column: {
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 48,
  },
  card: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  tileEmoji: { fontSize: 24 },
  title: { fontSize: 16, fontWeight: "600", color: colors.ink, textAlign: "center" },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink2,
    textAlign: "center",
    maxWidth: 384,
  },
  actions: { alignItems: "center", gap: spacing.sm },
  actionsHero: { marginTop: spacing.md },
  hint: { fontSize: 12, color: colors.ink3, textAlign: "center", marginTop: spacing.xs },

  // ── legacy hero ──
  heroBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  heroEmoji: { fontSize: 56 },
  heroDisc: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  heroIconDisc: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  heroDiscEmoji: { fontSize: 44 },
  heroTitle: { ...type.h2, color: colors.ink, textAlign: "center" },
  heroBody: {
    ...type.body,
    color: colors.ink2,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  heroCtaLabel: { fontWeight: "800" },
});
