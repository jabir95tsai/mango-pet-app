/**
 * Shared expense-category presentation — emoji + donut color per category, so
 * the overview card, the expenses donut, and the legend never drift. Colors
 * are drawn from the mango palette (shared-tokens). Category LABELS come from
 * the i18n catalog (Expense.categories.*), not here.
 */
import type { ExpenseCategory } from "@mango/shared-types";

import { colors } from "@/theme/theme";

export const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  food: "🍖",
  medical: "💊",
  grooming: "✂️",
  toy: "🧸",
  training: "🎓",
  insurance: "🛡️",
  other: "🧾",
};

/** Distinct donut/legend color per category (mango palette). */
export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  food: colors.cookie,
  medical: colors.leaf,
  grooming: colors.peach,
  toy: colors.brand,
  training: colors.amber,
  insurance: colors.ink3,
  other: colors.hairline,
};
