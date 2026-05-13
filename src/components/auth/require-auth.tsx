"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "./auth-provider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Common");

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        {t("loading")}
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
