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
import { subscribeAuth } from "@/lib/firebase/auth";
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
        try {
          await upsertUser(u, locale);
        } catch (err) {
          console.error("upsertUser failed:", err);
        }
      }
    });
    return unsub;
  }, [locale]);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
