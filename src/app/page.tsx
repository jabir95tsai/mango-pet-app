import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignInButtons } from "@/components/auth/sign-in-buttons";
import { LanguageSwitcher } from "@/components/nav/language-switcher";

export default async function Home() {
  const tApp = await getTranslations("App");
  const tAuth = await getTranslations("Auth");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 gap-10 text-center relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-col items-center gap-3">
        <span className="text-6xl" role="img" aria-label="mango">
          🥭
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
          {tApp("name")}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-md">
          {tApp("tagline")}
        </p>
      </div>

      <section className="flex flex-col items-center gap-5">
        <h2 className="text-xl font-semibold">{tAuth("welcome")}</h2>
        <p className="text-sm text-zinc-500 max-w-sm">{tAuth("subtitle")}</p>
        <SignInButtons />
      </section>

      <footer className="absolute bottom-4 inset-x-0 text-xs text-zinc-400 flex gap-4 justify-center">
        <Link href="/privacy" className="hover:text-amber-600">
          隱私權政策
        </Link>
        <Link href="/terms" className="hover:text-amber-600">
          服務條款
        </Link>
      </footer>
    </main>
  );
}
