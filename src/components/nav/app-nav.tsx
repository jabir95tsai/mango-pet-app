"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  PawPrint,
  Footprints,
  Trophy,
  MapPin,
  BookOpen,
  Users,
  Newspaper,
  Wallet,
  Settings,
  MoreHorizontal,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavKey =
  | "home"
  | "pets"
  | "feed"
  | "walks"
  | "leaderboard"
  | "expenses"
  | "restaurants"
  | "knowledge"
  | "friends"
  | "settings";

type Item = { href: string; key: NavKey; icon: LucideIcon };

const ALL_ITEMS: Item[] = [
  { href: "/app", key: "home", icon: Home },
  { href: "/app/pets", key: "pets", icon: PawPrint },
  { href: "/app/walks", key: "walks", icon: Footprints },
  { href: "/app/feed", key: "feed", icon: Newspaper },
  { href: "/app/expenses", key: "expenses", icon: Wallet },
  { href: "/app/leaderboard", key: "leaderboard", icon: Trophy },
  { href: "/app/restaurants", key: "restaurants", icon: MapPin },
  { href: "/app/knowledge", key: "knowledge", icon: BookOpen },
  { href: "/app/friends", key: "friends", icon: Users },
  { href: "/app/settings", key: "settings", icon: Settings },
];

// Mobile bottom bar: 4 primary items + "More" → drawer with the rest.
const MOBILE_PRIMARY_KEYS: NavKey[] = ["home", "pets", "walks", "expenses"];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppNav() {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const tApp = useTranslations("App");
  const tC = useTranslations("Common");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer when navigating
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const primary = ALL_ITEMS.filter((i) => MOBILE_PRIMARY_KEYS.includes(i.key));
  const overflow = ALL_ITEMS.filter((i) => !MOBILE_PRIMARY_KEYS.includes(i.key));
  const anyOverflowActive = overflow.some((i) => isActive(pathname, i.href));

  return (
    <>
      {/* Desktop sidebar (all items) */}
      <nav
        aria-label="Primary"
        className="hidden border-r border-zinc-200/80 bg-white/90 backdrop-blur md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col dark:border-zinc-800 dark:bg-zinc-950/90"
      >
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-4 dark:border-zinc-900">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg bg-amber-100 text-2xl dark:bg-amber-500/15"
            aria-hidden="true"
          >
            🥭
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-950 dark:text-zinc-50">
              {tApp("name")}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {tApp("tagline")}
            </p>
          </div>
        </div>

        <ul className="flex flex-col gap-1 p-3">
          {ALL_ITEMS.map(({ href, key, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                    active
                      ? "bg-amber-100/80 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  <span>{t(key)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile bottom tab bar (5 slots: 4 primary + More) */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/80 bg-white/95 shadow-[0_-8px_24px_rgba(24,24,27,0.08)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95 dark:shadow-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {primary.map(({ href, key, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-[3.75rem] min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                    active
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                  )}
                >
                  <Icon className="size-5" />
                  <span className="max-w-full truncate">{t(key)}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={t("more")}
              aria-expanded={drawerOpen}
              className={cn(
                "flex h-[3.75rem] w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                anyOverflowActive
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
            >
              <MoreHorizontal className="size-5" />
              <span className="max-w-full truncate">{t("more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          role="presentation"
        >
          <div
            className="w-full rounded-t-lg bg-white p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl dark:bg-zinc-950"
            role="dialog"
            aria-modal="true"
            aria-label={t("more")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {t("more")}
              </p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={tC("close")}
                className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {overflow.map(({ href, key, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 text-center text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                        active
                          ? "bg-amber-100/80 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                          : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="max-w-full leading-4">{t(key)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
