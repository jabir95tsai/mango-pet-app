// design-sync extra entry: merged onto window.MangoUI alongside the ui/ primitives.
// Dialog / PhotoLightbox / SaveToAlbumButton call next-intl's useTranslations, so
// previews (and any design built with them) wrap in NextIntlClientProvider with
// the shared zh-TW catalog — the same provider + messages apps/web uses.
export { NextIntlClientProvider } from "next-intl";
import { messages as catalogs, defaultLocale } from "@mango/shared-i18n";
export const mangoLocale = defaultLocale;
export const mangoMessages = catalogs[defaultLocale];
