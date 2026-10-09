/**
 * Shared expense-category presentation — lucide icon, card tone and donut
 * colour per category, so the expense card, the expenses donut and its legend
 * never drift. 1:1 with web:
 *  - CATEGORY_ICON / CATEGORY_TONE ← apps/web/src/components/pets/pet-expense-card.tsx TONE
 *  - CATEGORY_COLOR               ← apps/web/src/components/pets/pet-expenses-body.tsx CATEGORY_COLORS
 * Category LABELS come from the i18n catalog (Expense.categories.*), not here.
 */
import {
  Cookie,
  Gamepad2,
  GraduationCap,
  Receipt,
  Scissors,
  Shield,
  Stethoscope,
  type LucideIcon,
} from "lucide-react-native";
import type { ExpenseCategory } from "@mango/shared-types";

import { colors } from "@/theme/theme";

/** Web "leaf-deep" (pet-expenses-body medical slice + weight-trend stroke).
 *  Not part of the shared tokens; same hex web hard-codes. */
export const LEAF_DEEP = "#3f8a3a";
/** Web pet-expenses-body toy slice colour (not in the shared tokens). */
const TOY_ORANGE = "#ee9a5a";

/** Lucide icon per category (web pet-expense-card TONE.icon). */
export const CATEGORY_ICON: Record<ExpenseCategory, LucideIcon> = {
  food: Cookie,
  medical: Stethoscope,
  grooming: Scissors,
  toy: Gamepad2,
  training: GraduationCap,
  insurance: Shield,
  other: Receipt,
};

/** Icon-square tint + glyph colour per category (web pet-expense-card TONE). */
export const CATEGORY_TONE: Record<ExpenseCategory, { bg: string; fg: string }> = {
  food: { bg: colors.cookieTint, fg: colors.cookie },
  medical: { bg: colors.leafTint, fg: colors.leaf },
  grooming: { bg: colors.peachTint, fg: colors.cookie },
  toy: { bg: colors.brandTint, fg: colors.brandDeep },
  training: { bg: colors.leafTint, fg: colors.leaf },
  insurance: { bg: colors.bgAlt, fg: colors.ink2 },
  other: { bg: colors.bgAlt, fg: colors.ink2 },
};

/** Donut slice / legend swatch colour per category (web CATEGORY_COLORS). */
export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  food: colors.cookie, // #d77b3f
  medical: LEAF_DEEP, // #3f8a3a
  grooming: colors.brand, // #f39800
  toy: TOY_ORANGE, // #ee9a5a
  training: colors.leaf, // #5fa858
  insurance: colors.ink3, // #9a8a74
  other: colors.ink2, // #5a4a38
};
