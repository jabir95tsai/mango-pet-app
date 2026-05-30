import { redirect } from "next/navigation";

/**
 * The standalone /app/expenses page was folded into the per-pet
 * "開銷" tab on the pets detail page on 2026-05-26 (spec
 * docs/features/expenses-into-pets-page.md). Anything that used
 * to live here — filter pills, month total bar, category donut,
 * ExpenseCard list, FAB → receipt scanner, manual-entry form —
 * is now at `/app/pets/[petId]?tab=expenses`.
 *
 * This file stays only as a redirect so existing bookmarks /
 * deep-links (and the deprecated `?action=scan` from Bug Hunter
 * commit e972cf8) don't 404. Server-side redirect via Next.js
 * `redirect()` so no client-side flash; the pets page handles
 * the per-pet tab selection from there.
 *
 * Once telemetry shows zero hits on this route we can remove
 * the file entirely — leaving it indefinitely is cheap.
 */
export default function ExpensesRedirect() {
  redirect("/app/pets");
}
