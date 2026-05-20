import type { ReactNode } from "react";
import { AppNav } from "@/components/nav/app-nav";
import { RequireAuth } from "@/components/auth/require-auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex flex-1 flex-col md:flex-row">
        <AppNav />
        <div className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+4.5rem)] md:pb-0">
          <div className="max-w-3xl mx-auto p-6">{children}</div>
        </div>
      </div>
    </RequireAuth>
  );
}
