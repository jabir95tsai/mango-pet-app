"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signInWithProvider, type AuthProviderKind } from "@/lib/firebase/auth";
import { useAuth } from "./auth-provider";
import { cn } from "@/lib/utils";

const PROVIDERS: { kind: AuthProviderKind; labelKey: string; className: string }[] = [
  {
    kind: "google",
    labelKey: "signInWithGoogle",
    className: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50",
  },
  {
    kind: "apple",
    labelKey: "signInWithApple",
    className: "bg-black text-white hover:bg-zinc-800",
  },
  {
    kind: "facebook",
    labelKey: "signInWithFacebook",
    className: "bg-[#1877F2] text-white hover:bg-[#1464d0]",
  },
];

export function SignInButtons() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const { user } = useAuth();
  const [pending, setPending] = useState<AuthProviderKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace("/app");
  }, [user, router]);

  async function handleSignIn(kind: AuthProviderKind) {
    setPending(kind);
    setError(null);
    try {
      await signInWithProvider(kind);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      setError(message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      {PROVIDERS.map((p) => (
        <button
          key={p.kind}
          type="button"
          onClick={() => handleSignIn(p.kind)}
          disabled={pending !== null}
          className={cn(
            "h-12 rounded-full font-medium transition-colors disabled:opacity-60",
            p.className,
          )}
        >
          {pending === p.kind ? "..." : t(p.labelKey)}
        </button>
      ))}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
