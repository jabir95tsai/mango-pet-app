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
//
// Runtime language switching (SETTINGS-2 / SHELL-21) — mirrors web's
// LanguageSwitcher (繁中 | EN, persisted in the NEXT_LOCALE cookie):
//   - `setAppLocale(locale)` switches i18n + `activeLocale`, persists the
//     choice in AsyncStorage ("mango.locale") and notifies subscribers.
//   - `restorePersistedLocale()` re-applies the saved choice at startup; the
//     root layout waits for it (splash) before the first navigator render.
//   - `useLocale()` re-renders a component on change. The root layout keys its
//     navigator by the locale, so every mounted screen remounts with the new
//     strings (react-navigation rehydrates the same route stack).
// No saved choice → the device language (expo-localization), as before.
import { useSyncExternalStore } from "react";
import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  messages,
  defaultLocale,
  isLocale,
  locales,
  resolveLocale,
  type Locale,
} from "@mango/shared-i18n";

export type { Locale };

/** Locales the app can switch between (zh-TW first, like web). */
export const SUPPORTED_LOCALES: readonly Locale[] = locales;

/** AsyncStorage key holding the user's explicit language choice. */
export const LOCALE_STORAGE_KEY = "mango.locale";

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

/**
 * The locale currently rendered. A live `let` binding: it is reassigned by
 * `setAppLocale` / `restorePersistedLocale`, and ES-module importers read the
 * current value at the use site. Prefer `getActiveLocale()` (or `useLocale()`
 * in components) in new code — it never depends on the bundler's live-binding
 * semantics.
 */
export let activeLocale: Locale = detectLocale();
i18n.locale = activeLocale;

let restored = false;
let restoring: Promise<Locale> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // A broken subscriber must not block the others.
    }
  }
}

/** Apply a locale in memory. Returns true when it actually changed. */
function apply(locale: Locale): boolean {
  if (locale === activeLocale && i18n.locale === locale) return false;
  activeLocale = locale;
  i18n.locale = locale;
  return true;
}

/** The current app locale (always up to date). */
export function getActiveLocale(): Locale {
  return activeLocale;
}

/** True once the persisted choice (if any) has been applied. */
export function isLocaleRestored(): boolean {
  return restored;
}

/**
 * Re-apply the user's saved language (AsyncStorage) — call once at startup.
 * Idempotent and never rejects; resolves to the effective locale. A switch made
 * while the read is in flight wins over the stored value.
 */
export function restorePersistedLocale(): Promise<Locale> {
  if (restored) return Promise.resolve(activeLocale);
  if (restoring) return restoring;
  restoring = (async () => {
    let saved: string | null = null;
    try {
      saved = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (!restored) {
      if (isLocale(saved)) apply(saved);
      restored = true;
      emit();
    }
    restoring = null;
    return activeLocale;
  })();
  return restoring;
}

/**
 * Switch the app language at runtime (web LanguageSwitcher → setLocale).
 * Updates `t()` / `activeLocale` synchronously, notifies `useLocale()`
 * subscribers (the root navigator remounts its screens), then persists the
 * choice. Persisting is best-effort: a storage failure only means the choice
 * is not remembered after a restart.
 */
export async function setAppLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const wasRestored = restored;
  restored = true;
  const changed = apply(locale);
  if (changed || !wasRestored) emit();
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Non-fatal — see doc comment.
  }
}

/** Subscribe to locale changes (and the startup restore). Returns unsubscribe. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook: the current locale; re-renders the caller when it changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getActiveLocale, getActiveLocale);
}

/** React hook: false until the persisted locale has been restored. */
export function useLocaleRestored(): boolean {
  return useSyncExternalStore(subscribeLocale, isLocaleRestored, isLocaleRestored);
}

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
