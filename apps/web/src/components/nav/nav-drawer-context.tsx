"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type NavDrawerContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const NavDrawerContext = createContext<NavDrawerContextValue | null>(null);

/**
 * Owns the mobile overflow-drawer's open state so any page can trigger it.
 * Lives at the AppLayout boundary so the drawer (rendered inside AppNav) and
 * the trigger (e.g. settings page top-right MoreHorizontal button) share one
 * state instance across navigations.
 */
export function NavDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <NavDrawerContext.Provider value={value}>
      {children}
    </NavDrawerContext.Provider>
  );
}

export function useNavDrawer(): NavDrawerContextValue {
  const ctx = useContext(NavDrawerContext);
  if (!ctx) {
    throw new Error("useNavDrawer must be used inside <NavDrawerProvider>");
  }
  return ctx;
}
