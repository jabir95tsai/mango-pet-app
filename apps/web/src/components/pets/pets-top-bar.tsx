"use client";

import { Plus } from "lucide-react";

/**
 * Pets page top bar — large warm-cream h1 + brand-tint "+ 寵物" pill.
 * Ports prototype `TopBar` (pets-screen.jsx line 199–222), tweaked to
 * Tailwind + mango tokens. The title flips between "我的寵物" (list) and
 * "寵物資料" (detail) — the caller picks which i18n key to pass in.
 */
type Props = {
  title: string;
  addLabel: string;
  onAdd: () => void;
};

export function PetsTopBar({ title, addLabel, onAdd }: Props) {
  return (
    <div className="flex items-center justify-between gap-2 pb-1.5">
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px] text-mango-ink">
        {title}
      </h1>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex h-[34px] shrink-0 items-center gap-1 rounded-full bg-mango-brand-tint pr-3 pl-2 text-sm font-bold text-mango-brand-deep transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        {addLabel}
      </button>
    </div>
  );
}
