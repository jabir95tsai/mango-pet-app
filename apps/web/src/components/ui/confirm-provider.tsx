"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";

type ConfirmOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpts(next);
    });
  }, []);

  function settle(result: boolean) {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setOpts(null);
    resolver?.(result);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={opts !== null}
        onClose={() => settle(false)}
        title={opts?.title ?? "確認"}
      >
        <div className="flex flex-col gap-5">
          {opts?.message && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {opts.message}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => settle(false)}>
              {opts?.cancelText ?? "取消"}
            </Button>
            <Button
              variant={opts?.danger ? "danger" : "primary"}
              onClick={() => settle(true)}
              autoFocus
            >
              {opts?.confirmText ?? "確定"}
            </Button>
          </div>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback to native confirm if provider missing (shouldn't happen in app)
    return async (opts) =>
      typeof window === "undefined"
        ? false
        : window.confirm(opts.message ?? opts.title ?? "?");
  }
  return ctx;
}
