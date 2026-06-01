import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 gap-6 text-center">
      <span className="text-6xl" role="img" aria-label="lost">
        🥭🐾
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-zinc-500">{t("subtitle")}</p>
      </div>
      <Link
        href="/"
        className="btn-mango flex h-10 items-center rounded-lg px-5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        {t("home")}
      </Link>
    </main>
  );
}
