"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Images } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { listMyPhotoAssets } from "@/lib/firebase/photo-gallery";
import type { GalleryPhotoAsset } from "@/lib/types";

const PREVIEW_COUNT = 3;

/**
 * Settings → latest-photos preview. Replaces the old photo-gallery icon
 * button (which used to sit in the profile header) with a small block
 * above the family section: the 3 most-recent photos as a tap-through to
 * the full /app/photos gallery. Reuses `listMyPhotoAssets` — the same
 * aggregator the gallery page uses — and slices the newest 3.
 */
export function PhotosPreviewSection() {
  const tS = useTranslations("Settings");
  const tPv = useTranslations("Settings.photosPreview");
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();
  const [photos, setPhotos] = useState<GalleryPhotoAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || familyLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const assets = await listMyPhotoAssets(
          user.uid,
          family?.familyId ?? null,
        );
        if (!cancelled) setPhotos(assets.slice(0, PREVIEW_COUNT));
      } catch {
        if (!cancelled) setPhotos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, family, familyLoading]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mango-card-soft text-mango-brand-deep ring-1 ring-mango-hairline">
            <Images className="size-4" />
          </span>
          <p className="font-semibold">{tS("photosLink")}</p>
        </div>
        <Link
          href="/app/photos"
          className="rounded-full px-2 py-1 text-xs font-semibold text-mango-brand-deep transition-colors hover:bg-mango-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
        >
          {tPv("viewAll")}
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800"
            />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <Link
          href="/app/photos"
          className="grid place-items-center rounded-lg border border-dashed border-zinc-300/80 py-6 text-sm text-zinc-500 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          {tPv("empty")}
        </Link>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <Link
              key={p.id}
              href="/app/photos"
              aria-label={tS("photosLink")}
              className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:bg-zinc-800"
            >
              <Image
                src={p.url}
                alt=""
                fill
                sizes="(max-width: 640px) 33vw, 160px"
                className="object-cover"
                unoptimized
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
