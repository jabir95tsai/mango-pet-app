"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PetTab } from "./pet-tabs";
import { PET_TABS } from "./pet-tabs";

/**
 * URL-bound tab state. Stored in `?tab=...` so deep links land on the
 * right tab and back/forward inside a pet preserve context. Uses
 * `router.replace` (not push) so tab toggles don't bloat history —
 * spec edge-case row "Tab switch URL state".
 */
export function usePetTab(defaultTab: PetTab = "overview"): {
  tab: PetTab;
  setTab: (next: PetTab) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: PetTab = (PET_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as PetTab)
    : defaultTab;

  const setTab = useCallback(
    (next: PetTab) => {
      const sp = new URLSearchParams(params.toString());
      if (next === defaultTab) {
        sp.delete("tab");
      } else {
        sp.set("tab", next);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router, defaultTab],
  );

  return { tab, setTab };
}
