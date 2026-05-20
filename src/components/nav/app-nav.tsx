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
      <nav className="hidden md:flex md:flex-col md:h-screen md:w-60 md:shrink-0 border-r border-amber-200/60 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <ul className="flex flex-col gap-1 p-3">
          {ALL_ITEMS.map(({ href, key, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "text-amber-600 bg-amber-100/60 dark:text-amber-400 dark:bg-amber-500/10"
                      : "text-zinc-600 hover:text-amber-600 hover:bg-amber-50 dark:text-zinc-400 dark:hover:bg-zinc-900",
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
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-amber-200/60 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {primary.map(({ href, key, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 h-14 text-[10px] font-medium transition-colors",
                    active
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-zinc-500 hover:text-amber-600 dark:text-zinc-400",
                  )}
                >
                  <Icon className="size-5" />
                  <span>{t(key)}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="更多"
              className={cn(
                "w-full flex flex-col items-center justify-center gap-0.5 h-14 text-[10px] font-medium transition-colors",
                anyOverflowActive
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-500 hover:text-amber-600 dark:text-zinc-400",
              )}
            >
              <MoreHorizontal className="size-5" />
              <span>{t("more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 flex items-end"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl bg-white dark:bg-zinc-950 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <ul className="grid grid-cols-3 gap-2">
              {overflow.map(({ href, key, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs font-medium transition-colors",
                        active
                          ? "text-amber-600 bg-amber-100/60 dark:text-amber-400 dark:bg-amber-500/10"
                          : "text-zinc-700 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                      )}
                    >
                      <Icon className="size-5" />
                      <span>{t(key)}</span>
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
