"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { useLocale } from "next-intl";
import { subscribeAuth, syncAuthProfileFromProviders } from "@/lib/firebase/auth";
import { setupPushMessageListener } from "@/lib/firebase/messaging";
import { upsertUser } from "@/lib/firebase/users";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const locale = useLocale() as "zh-TW" | "en";

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      setLoading(false);
      return;
    }
    const unsub = subscribeAuth(async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // Backfill top-level Auth displayName/photoURL from providerData
        // for multi-provider accounts BEFORE upsertUser, so the profile
        // doc (and every downstream denormalised write) gets the real
        // values instead of null. Best-effort — upsertUser below resolves
        // from providerData too, so a failure here still self-heals the
        // users doc.
        try {
          await syncAuthProfileFromProviders(u);
        } catch (err) {
          console.error("syncAuthProfileFromProviders failed:", err);
        }
        try {
          await upsertUser(u, locale);
        } catch (err) {
          console.error("upsertUser failed:", err);
        }
      }
    });
    return unsub;
  }, [locale]);

  // Wire up the foreground push handler. Without this, pushes that arrive
  // while a tab is in focus (e.g. you click "測試" on the Settings page and
  // wait there) are silently dropped by the Firebase SDK — the SW's
  // onBackgroundMessage only fires when no foreground tab exists.
  // Subscribing once per signed-in session is enough; the listener is a
  // no-op on browsers that don't support push.
  useEffect(() => {
    if (!user) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const off = await setupPushMessageListener();
        if (cancelled) {
          off();
        } else {
          unsubscribe = off;
        }
      } catch (err) {
        console.error("setupPushMessageListener failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
