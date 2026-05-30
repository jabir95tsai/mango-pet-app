import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type Locale = (typeof routing.locales)[number];

function pickLocale(value: string | undefined | null): Locale | null {
  if (!value) return null;
  return routing.locales.includes(value as Locale) ? (value as Locale) : null;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const fromCookie = pickLocale(cookieStore.get("NEXT_LOCALE")?.value);

  let locale: Locale = fromCookie ?? routing.defaultLocale;
  if (!fromCookie) {
    const acceptLanguage = (await headers()).get("accept-language") ?? "";
    const preferred = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
    if (preferred.startsWith("zh")) locale = "zh-TW";
    else if (preferred.startsWith("en")) locale = "en";
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
