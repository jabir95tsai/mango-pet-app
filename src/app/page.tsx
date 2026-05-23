import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { SignInButtons } from "@/components/auth/sign-in-buttons";
import { LanguageSwitcher } from "@/components/nav/language-switcher";

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

function getNextPath(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;

  if (value === "/app" || value?.startsWith("/app/")) {
    return value;
  }

  return "/app";
}

export default async function Home({ searchParams }: Props) {
  const tApp = await getTranslations("App");
  const tAuth = await getTranslations("Auth");
  const tC = await getTranslations("Common");
  const nextPath = getNextPath((await searchParams).next);

  return (
    <main className="flex min-h-dvh flex-1 flex-col px-4 py-5 sm:px-6">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-10 text-center">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/icons/mango-pet-logo.png"
            alt=""
            width={84}
            height={84}
            priority
            className="rounded-lg shadow-lg shadow-amber-500/20"
          />
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-zinc-950 dark:text-zinc-50">
              {tApp("name")}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {tApp("tagline")}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200/80 bg-white/85 p-5 shadow-sm shadow-zinc-200/50 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85 dark:shadow-none">
          <div className="mb-5 space-y-2">
            <h2 className="text-xl font-semibold">{tAuth("welcome")}</h2>
            <p className="text-sm leading-6 text-zinc-500">
              {tAuth("subtitle")}
            </p>
          </div>
          <SignInButtons nextPath={nextPath} />
        </div>
      </section>

      <footer className="flex justify-center gap-4 pb-2 text-xs text-zinc-400">
        <Link href="/privacy" className="hover:text-amber-700">
          {tC("privacy")}
        </Link>
        <Link href="/terms" className="hover:text-amber-700">
          {tC("terms")}
        </Link>
      </footer>
    </main>
  );
}
