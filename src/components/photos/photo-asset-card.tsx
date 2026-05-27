"use client";

import Image from "next/image";
import { format } from "date-fns";
import { enUS, zhTW } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Check, Download } from "lucide-react";
import type { GalleryPhotoAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  asset: GalleryPhotoAsset;
  downloaded: boolean;
  selected: boolean;
  saving: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
  onSave: () => void;
};

const SOURCE_KEYS: Record<GalleryPhotoAsset["source"], string> = {
  post: "post",
  walk: "walk",
  "pet-avatar": "petAvatar",
  "expense-receipt": "expenseReceipt",
};

export function PhotoAssetCard({
  asset,
  downloaded,
  selected,
  saving,
  onOpen,
  onToggleSelected,
  onSave,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("Photos");
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;
  const createdMs = asset.createdAt?.toMillis?.() ?? Date.now();
  const dateText = format(new Date(createdMs), "yyyy/MM/dd", {
    locale: dateLocale,
  });

  return (
    <article className="group overflow-hidden rounded-lg border border-mango-hairline bg-mango-card shadow-sm">
      <div className="relative aspect-square bg-mango-bg-alt">
        <button
          type="button"
          onClick={onOpen}
          className="relative block size-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mango-brand-deep"
          aria-label={t("openPhoto", { title: asset.title })}
        >
          <Image
            src={asset.url}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            unoptimized
          />
        </button>

        <button
          type="button"
          onClick={onToggleSelected}
          aria-pressed={selected}
          aria-label={selected ? t("deselect") : t("select")}
          className={cn(
            "absolute left-2 top-2 grid size-11 place-items-center rounded-full border text-sm font-bold shadow-sm backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
            selected
              ? "border-mango-brand-deep bg-mango-brand text-mango-ink"
              : "border-white/80 bg-black/35 text-white",
          )}
        >
          {selected ? <Check className="size-5" /> : ""}
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          aria-label={t("saveOne")}
          className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur transition-colors hover:bg-black/65 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
        >
          <Download className="size-5" />
        </button>

        <span className="absolute left-2 bottom-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {t(`sources.${SOURCE_KEYS[asset.source]}`)}
        </span>
        {!downloaded ? (
          <span className="absolute right-2 bottom-2 rounded-full bg-mango-brand px-2.5 py-1 text-[11px] font-bold text-mango-ink shadow-sm">
            {t("newBadge")}
          </span>
        ) : (
          <span
            className="absolute right-2 bottom-2 grid size-7 place-items-center rounded-full bg-white/90 text-mango-brand-deep shadow-sm"
            aria-label={t("downloaded")}
            title={t("downloaded")}
          >
            <Check className="size-4" />
          </span>
        )}
      </div>

      <div className="flex min-h-[5.25rem] flex-col gap-1 p-3">
        <p className="line-clamp-1 text-sm font-semibold text-mango-ink">
          {asset.petName ?? asset.title}
        </p>
        <p className="line-clamp-1 text-xs text-mango-ink-2">{asset.title}</p>
        <p className="mt-auto text-xs text-mango-ink-3">{dateText}</p>
      </div>
    </article>
  );
}
