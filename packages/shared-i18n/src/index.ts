/**
 * @mango/shared-i18n — the single cross-platform source of truth for UI copy.
 *
 * The zh-TW / en message catalogs live here (moved out of apps/web/messages on
 * 2026-06-02, P2-pre). Both platforms read the SAME JSON:
 *   - web  → next-intl (`apps/web/src/i18n/request.ts` imports `getMessages`)
 *   - ios  → i18n-js    (`apps/ios/src/lib/i18n.ts` builds a `t()` from these)
 *
 * This package is intentionally PURE — no next-intl, no i18n-js, no
 * expo-localization. Pulling any platform runtime in here would break the
 * other platform's bundle. Each app owns its own i18n runtime and consumes
 * this catalog.
 *
 * Catalog form (resolves spec Open-Q1): plain JSON imported as typed objects.
 * `Messages` is derived from zh-TW (the complete reference locale) via
 * `typeof`, so consumers still get key autocompletion without re-authoring
 * 950 lines as a TS object literal.
 */
import zhTW from "./messages/zh-TW.json";
import en from "./messages/en.json";

export const locales = ["zh-TW", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "zh-TW";

/** All catalogs keyed by locale. */
export const messages: Record<Locale, typeof zhTW> = {
  "zh-TW": zhTW,
  en: en as typeof zhTW,
};

/** Shape of a single catalog (derived from the complete zh-TW reference). */
export type Messages = typeof zhTW;

/** Catalog for a supported locale, falling back to the default. */
export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages[defaultLocale];
}

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (locales as readonly string[]).includes(value)
  );
}

/**
 * Normalise an arbitrary platform locale tag (e.g. "zh-Hant-TW", "en-US",
 * "zh") to a supported app locale. Used by the iOS locale probe
 * (expo-localization) and the web Accept-Language fallback.
 */
export function resolveLocale(raw: string | null | undefined): Locale {
  if (!raw) return defaultLocale;
  const lower = raw.toLowerCase();
  if (lower.startsWith("zh")) return "zh-TW";
  if (lower.startsWith("en")) return "en";
  return defaultLocale;
}
