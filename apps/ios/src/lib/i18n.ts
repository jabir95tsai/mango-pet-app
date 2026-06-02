// iOS i18n runtime — consumes the SAME catalog as web (@mango/shared-i18n) via
// i18n-js, with the device locale detected by expo-localization. The web side
// reads this catalog through next-intl; this is the React Native equivalent.
//
// Catalog placeholders use next-intl's single-brace ICU style ("{name}"), so
// i18n-js's placeholder regex is overridden from its default ({{name}} / %{name})
// to single-brace below. The catalog has NO ICU plural/select constructs
// (verified P2-pre 2026-06-02) — only simple {var} interpolation — so i18n-js
// renders every string the web shows. If a future catalog entry needs ICU
// plurals, handle it at the call site (i18n-js is not a MessageFormat engine).
import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";
import {
  messages,
  defaultLocale,
  resolveLocale,
  type Locale,
} from "@mango/shared-i18n";

const i18n = new I18n(messages, {
  defaultLocale,
  // Missing key in the active locale → fall back to defaultLocale (zh-TW is
  // the complete reference catalog), not the "[missing ...]" marker.
  enableFallback: true,
});

// Match next-intl's single-brace placeholders: "{name}" (not "{{name}}").
i18n.placeholder = /\{([^{}]+)\}/g;

/** Best-effort device locale, normalised to a supported app locale. Falls
 *  back to the default if the native module is unavailable for any reason. */
function detectLocale(): Locale {
  try {
    const tag = getLocales()[0]?.languageTag ?? null;
    return resolveLocale(tag);
  } catch {
    return defaultLocale;
  }
}

export const activeLocale: Locale = detectLocale();
i18n.locale = activeLocale;

/**
 * Translate a FULLY-qualified dotted key from the shared catalog, e.g.
 * `t("PetsPage.title")` or `t("Pet.fields.weightKg")`. Interpolation vars use
 * single-brace placeholders: `t("Walks.goalChip", { n: 30 })` for `"{n} 分鐘"`.
 *
 * Unlike web's namespaced `useTranslations("PetsPage")` (then `t("title")`),
 * this takes the whole path — keep call sites explicit.
 */
export function t(
  key: string,
  options?: Record<string, string | number>,
): string {
  return i18n.t(key, options);
}

/** Curried namespace helper mirroring next-intl's `useTranslations(ns)`:
 *  `const tp = scoped("PetsPage"); tp("title")`. */
export function scoped(namespace: string) {
  return (key: string, options?: Record<string, string | number>): string =>
    t(`${namespace}.${key}`, options);
}

export { i18n };
