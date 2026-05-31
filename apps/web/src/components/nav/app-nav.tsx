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
  Images,
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
  | "photos"
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
  { href: "/app/photos", key: "photos", icon: Images },
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

      {/* Mobile bottom tab bar — Mango v2 notched bar (spec
       *  docs/features/nav-cta-mango-v2.md §1).
       *  - Surface: an SVG path with a concave centre notch, filled via
       *    currentColor (text-mango-card-soft, swaps in dark mode);
       *    preserveAspectRatio="none" stretches the 390-wide path to any
       *    phone width while the dip stays centred. drop-shadow gives the
       *    spec's `0 -8px 22px` top shadow following the contour; a
       *    non-scaling 1px hairline traces the top edge.
       *  - Walks (index 2): a 62px gradient disc nests in the notch and
       *    its top edge breaks above the bar (not a flat overlay), with a
       *    5px mango-bg ring "cutting" through, white solid paw, and a
       *    遛狗 label below. active → scale(1.06).
       *  - Other 4 slots: 24px icon, active = brand-deep + 700 label +
       *    icon lifted 2px + a 5px brand dot; inactive = ink-2 (AA on
       *    cream — spec's ink-3 fails AA at 10px). Spring transition.
       *  - Rendered bar height stays 60px so the layout's existing
       *    bottom clearance (4.75rem) is unchanged; the disc's 16px
       *    protrusion uses the same 16px the old raised button did.
       *  - Desktop sidebar above untouched.
       */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="relative h-[3.75rem]">
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full text-mango-card-soft dark:text-zinc-950"
            viewBox="0 0 390 78"
            preserveAspectRatio="none"
            style={{ filter: "drop-shadow(0 -8px 22px rgba(80,50,10,0.10))" }}
          >
            <path
              d="M0,0 H143 C169,0 161,40 195,40 C229,40 221,0 247,0 H390 V78 H0 Z"
              fill="currentColor"
              stroke="var(--color-mango-hairline)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <ul className="relative grid h-full grid-cols-5">
            {primary.map(({ href, key, icon: Icon }) => {
              const active = isActive(pathname, href);
              const isRaised = key === "walks";

              if (isRaised) {
                // ── Raised centre: walks ────────────────────────
                // <li> is the grid cell — relative so the disc can pop
                // upward. The disc is an absolutely-positioned span so
                // the whole cell (disc + label) is the tap target.
                return (
                  <li key={href} className="relative">
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      aria-label={t(key)}
                      className="relative flex h-full flex-col items-center justify-end pb-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute left-1/2 top-[-16px] grid size-[62px] -translate-x-1/2 place-items-center rounded-full transition-transform duration-[280ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 motion-reduce:transition-none",
                          active ? "scale-[1.06]" : "scale-100",
                        )}
                        style={{
                          background:
                            "linear-gradient(160deg, var(--color-mango-brand), var(--color-mango-brand-deep))",
                          boxShadow:
                            "0 10px 22px -5px rgba(243,152,0,0.55), 0 0 0 5px var(--color-mango-bg)",
                        }}
                      >
                        <PawPrint
                          className="size-[26px] text-white"
                          strokeWidth={2}
                          fill="currentColor"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="text-[10.5px] font-bold leading-none text-mango-brand-deep">
                        {t(key)}
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
                    className="flex h-full min-w-0 flex-col items-center justify-center gap-1 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
                  >
                    <Icon
                      className={cn(
                        "size-6 transition-[transform,color] duration-[280ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
                        active
                          ? "-translate-y-0.5 text-mango-brand-deep dark:text-amber-300"
                          : "text-mango-ink-2 dark:text-zinc-400",
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "max-w-full truncate text-[10px] leading-none transition-colors duration-[280ms] motion-reduce:transition-none",
                        active
                          ? "font-bold text-mango-brand-deep dark:text-amber-300"
                          : "font-medium text-mango-ink-2 dark:text-zinc-400",
                      )}
                    >
                      {t(key)}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-[5px] rounded-full bg-mango-brand transition-opacity duration-[280ms] motion-reduce:transition-none",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
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
