"use client";

import { useEffect } from "react";
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
  Settings,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavDrawer } from "./nav-drawer-context";

type NavKey =
  | "home"
  | "pets"
  | "feed"
  | "walks"
  | "leaderboard"
  | "restaurants"
  | "knowledge"
  | "friends"
  | "settings";

type Item = { href: string; key: NavKey; icon: LucideIcon };

// `expenses` entry removed 2026-05-26 — full expense management now
// lives inside the pets detail 開銷 tab (spec
// docs/features/expenses-into-pets-page.md). /app/expenses still
// redirects to /app/pets for old bookmarks.
const ALL_ITEMS: Item[] = [
  { href: "/app", key: "home", icon: Home },
  { href: "/app/pets", key: "pets", icon: PawPrint },
  { href: "/app/walks", key: "walks", icon: Footprints },
  { href: "/app/feed", key: "feed", icon: Newspaper },
  { href: "/app/leaderboard", key: "leaderboard", icon: Trophy },
  { href: "/app/restaurants", key: "restaurants", icon: MapPin },
  { href: "/app/knowledge", key: "knowledge", icon: BookOpen },
  { href: "/app/friends", key: "friends", icon: Users },
  { href: "/app/settings", key: "settings", icon: Settings },
];

// Mobile bottom bar: 5 primary nav links fill all slots.
// The overflow drawer is now triggered from the settings page top-right
// corner — see `src/app/app/settings/page.tsx` and `useNavDrawer()`.
//
// Phase 0.5 (visual-redesign-mango v2): the middle slot ("walks") is
// rendered as a RAISED circular button that pops above the bar's top
// edge. Order is unchanged so existing pathname → tab mapping still
// works; only the middle item's rendering branches.
const MOBILE_PRIMARY_KEYS: NavKey[] = [
  "home",
  "pets",
  "walks",
  "leaderboard",
  "settings",
];

// Items deliberately HIDDEN from the mobile overflow drawer (still listed
// in the desktop sidebar). Feed left the drawer per spec
// docs/features/reminders-to-pets-page.md (Home + Pets IA reorg, C
// section) because the home page now IS the feed — the drawer entry
// duplicated the destination. Friends left the drawer + sidebar per
// docs/features/ui-polish-bundle-2026-05-25.md Item #1 — the new entry
// is the Users icon button next to the user avatar in /app/settings.
const MOBILE_DRAWER_EXCLUDE: NavKey[] = ["feed", "friends"];
const DESKTOP_SIDEBAR_EXCLUDE: NavKey[] = ["friends"];

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
  const { open: drawerOpen, setOpen: setDrawerOpen } = useNavDrawer();

  // Close drawer when navigating
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, setDrawerOpen]);

  const primary = ALL_ITEMS.filter((i) => MOBILE_PRIMARY_KEYS.includes(i.key));
  const overflow = ALL_ITEMS.filter(
    (i) =>
      !MOBILE_PRIMARY_KEYS.includes(i.key) &&
      !MOBILE_DRAWER_EXCLUDE.includes(i.key),
  );

  return (
    <>
      {/* Desktop sidebar (all items) — UNCHANGED in Phase 0.5 */}
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
          {ALL_ITEMS.filter(
            (i) => !DESKTOP_SIDEBAR_EXCLUDE.includes(i.key),
          ).map(({ href, key, icon: Icon }) => {
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

      {/* Mobile bottom tab bar — Phase 0.5 raised center treatment.
       *  - Surface: warm soft-card tint + backdrop-blur (matches mockup TabBar)
       *  - Hairline: mango.hairline (warmer than zinc-200)
       *  - Walks (index 2) renders a raised circular brand button
       *    bursting above the bar's top edge via absolute -top-4 + a
       *    4px ring of mango.bg that visually "cuts" through the bar.
       *  - Other 4 slots keep the column layout; active/inactive map
       *    to mango.brand / mango.ink-2 (AA passes against cream bg).
       *  - Desktop sidebar above untouched.
       */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-mango-hairline bg-mango-card-soft/92 shadow-[0_-8px_24px_rgba(80,50,10,0.10)] backdrop-blur-md md:hidden dark:border-zinc-800 dark:bg-zinc-950/95 dark:shadow-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {primary.map(({ href, key, icon: Icon }) => {
            const active = isActive(pathname, href);
            const isRaised = key === "walks";

            if (isRaised) {
              // ── Raised center: walks ────────────────────────
              // <li> is the grid cell — relative so the button can
              // pop upward. <Link> spans the cell; the raised disc
              // is an absolutely-positioned span inside the link so
              // the entire surface (disc + label) is the tap target.
              return (
                <li key={href} className="relative">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    aria-label={t(key)}
                    className="relative block h-[3.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 -top-4 grid size-[60px] -translate-x-1/2 place-items-center rounded-full bg-mango-brand text-mango-ink shadow-mango ring-4 ring-mango-bg transition-transform duration-200 ease-out active:scale-95"
                    >
                      <Icon
                        className="size-[26px]"
                        strokeWidth={2.4}
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              );
            }

            // ── Standard slots: home / pets / leaderboard / settings ──
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-[3.75rem] min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
                    active
                      ? "text-mango-brand dark:text-amber-300"
                      : "text-mango-ink-2 hover:text-mango-ink dark:text-zinc-400 dark:hover:text-zinc-100",
                  )}
                >
                  <Icon className="size-5" />
                  <span className="max-w-full truncate">{t(key)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile drawer — UNCHANGED in Phase 0.5 */}
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
