"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app", key: "home", icon: Home },
  { href: "/app/pets", key: "pets", icon: PawPrint },
  { href: "/app/feed", key: "feed", icon: Newspaper },
  { href: "/app/walks", key: "walks", icon: Footprints },
  { href: "/app/leaderboard", key: "leaderboard", icon: Trophy },
  { href: "/app/expenses", key: "expenses", icon: Wallet },
  { href: "/app/restaurants", key: "restaurants", icon: MapPin },
  { href: "/app/knowledge", key: "knowledge", icon: BookOpen },
  { href: "/app/friends", key: "friends", icon: Users },
  { href: "/app/settings", key: "settings", icon: Settings },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-amber-200/60 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 md:static md:border-t-0 md:border-r md:h-screen md:w-60 md:shrink-0">
      <ul className="flex md:flex-col overflow-x-auto md:overflow-visible md:gap-1 md:p-3">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/app" && pathname?.startsWith(href));
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                className={cn(
                  "flex flex-col md:flex-row items-center gap-1 md:gap-3 py-2 md:py-2.5 md:px-3 rounded-lg text-xs md:text-sm font-medium transition-colors",
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
  );
}
