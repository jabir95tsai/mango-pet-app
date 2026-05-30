"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Camera, Images } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { PhotoDownloadButton } from "@/components/photos/photo-download-button";
import { PhotoGalleryGrid } from "@/components/photos/photo-gallery-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import {
  listDownloadedPhotoAssetIds,
  listMyPhotoAssetsWithStatus,
  markPhotoAssetsDownloaded,
  type PhotoGallerySourceKey,
} from "@/lib/firebase/photo-gallery";
import { shareOrDownloadPhotosFromUrls } from "@/lib/photo-download";
import type { GalleryPhotoAsset, GalleryPhotoSource } from "@/lib/types";
import { cn } from "@/lib/utils";

type FilterKey = "all" | GalleryPhotoSource;

const FILTERS: FilterKey[] = [
  "all",
  "post",
  "walk",
  "pet-avatar",
  "expense-receipt",
];

const FILTER_I18N_KEY: Record<FilterKey, string> = {
  all: "all",
  post: "post",
  walk: "walk",
  "pet-avatar": "petAvatar",
  "expense-receipt": "expenseReceipt",
};

function toDownloadRequest(asset: GalleryPhotoAsset) {
  return {
    id: asset.id,
    url: asset.url,
    fileName: asset.fileName,
    title: asset.title,
  };
}

export default function PhotosPage() {
  const t = useTranslations("Photos");
  const tC = useTranslations("Common");
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  const [assets, setAssets] = useState<GalleryPhotoAsset[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [failedSources, setFailedSources] = useState<PhotoGallerySourceKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [status, setStatus] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [galleryR, downloadedR] = await Promise.allSettled([
        listMyPhotoAssetsWithStatus(user.uid, family?.familyId ?? null),
        listDownloadedPhotoAssetIds(user.uid),
      ]);
      if (galleryR.status === "fulfilled") {
        setAssets(galleryR.value.assets);
        setFailedSources(galleryR.value.failedSources);
      } else {
        setAssets([]);
        setFailedSources(["posts", "walks", "pets", "expenses"]);
      }
      setDownloadedIds(
        downloadedR.status === "fulfilled" ? downloadedR.value : new Set(),
      );
    } finally {
      setLoading(false);
    }
  }, [user, family]);

  useEffect(() => {
    if (familyLoading) return;
    refresh();
  }, [familyLoading, refresh]);

  const filteredAssets = useMemo(
    () => (filter === "all" ? assets : assets.filter((asset) => asset.source === filter)),
    [assets, filter],
  );

  const undownloadedAssets = useMemo(
    () => assets.filter((asset) => !downloadedIds.has(asset.id)),
    [assets, downloadedIds],
  );

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.has(asset.id)),
    [assets, selectedIds],
  );

  const subtitle = t("subtitle", {
    total: assets.length,
    remaining: undownloadedAssets.length,
  });

  function toggleSelected(assetId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  function openAsset(asset: GalleryPhotoAsset) {
    const idx = filteredAssets.findIndex((item) => item.id === asset.id);
    setLightboxIdx(Math.max(0, idx));
    setLightboxOpen(true);
  }

  async function saveAssets(targets: GalleryPhotoAsset[]) {
    if (!user || targets.length === 0) return;
    setStatus(null);
    setSavingIds(new Set(targets.map((asset) => asset.id)));
    try {
      const result = await shareOrDownloadPhotosFromUrls(
        targets.map(toDownloadRequest),
        t("shareTitle"),
      );
      const completed = targets.filter((asset) =>
        result.completedAssetIds.includes(asset.id),
      );
      if (completed.length > 0) {
        await markPhotoAssetsDownloaded(user.uid, completed, result.mode);
        setDownloadedIds((prev) => {
          const next = new Set(prev);
          for (const asset of completed) next.add(asset.id);
          return next;
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const asset of completed) next.delete(asset.id);
          return next;
        });
      }
      if (result.cancelled) {
        setStatus(t("status.cancelled", { count: completed.length }));
      } else if (result.failures.length > 0) {
        setStatus(t("status.partial", { count: completed.length }));
      } else {
        setStatus(t("status.saved", { count: completed.length }));
      }
    } catch {
      setStatus(t("status.failed"));
    } finally {
      setSavingIds(new Set());
    }
  }

  const mainActionLabel =
    undownloadedAssets.length === 0
      ? t("actions.allSaved")
      : t("actions.saveRemaining", { count: undownloadedAssets.length });

  const visibleLightboxPhotos = filteredAssets.map((asset) => asset.url);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <RouteHeader title={t("title")} subtitle={subtitle} className="mb-0" />
        <div className="flex flex-col gap-2 sm:items-end">
          <PhotoDownloadButton
            label={savingIds.size > 0 ? t("actions.saving") : mainActionLabel}
            busy={savingIds.size > 0}
            disabled={undownloadedAssets.length === 0}
            onClick={() => saveAssets(undownloadedAssets)}
          />
          {selectedAssets.length > 0 && (
            <PhotoDownloadButton
              label={t("actions.saveSelected", { count: selectedAssets.length })}
              variant="secondary"
              busy={savingIds.size > 0}
              onClick={() => saveAssets(selectedAssets)}
            />
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((key) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
                active
                  ? "border-mango-brand bg-mango-brand text-mango-ink"
                  : "border-mango-hairline bg-white text-mango-ink-2 hover:bg-mango-bg-alt",
              )}
            >
              {t(`filters.${FILTER_I18N_KEY[key]}`)}
            </button>
          );
        })}
      </div>

      {failedSources.length > 0 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("partialError")}
        </p>
      )}
      {status && (
        <p className="mb-4 rounded-lg border border-mango-hairline bg-mango-card-soft px-3 py-2 text-sm text-mango-ink-2">
          {status}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-mango-ink-2">{tC("loading")}</p>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Images}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/app/feed"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-mango-brand px-4 text-sm font-semibold text-mango-ink transition-colors hover:bg-mango-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
              >
                <Camera className="size-4" />
                {t("empty.feedCta")}
              </Link>
              <Link
                href="/app/walks"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-mango-hairline bg-white px-4 text-sm font-semibold text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
              >
                {t("empty.walkCta")}
              </Link>
            </div>
          }
        />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={Images}
          title={t("emptyFilter.title")}
          description={t("emptyFilter.description")}
        />
      ) : (
        <PhotoGalleryGrid
          assets={filteredAssets}
          downloadedIds={downloadedIds}
          selectedIds={selectedIds}
          savingIds={savingIds}
          onOpen={openAsset}
          onToggleSelected={toggleSelected}
          onSave={(asset) => saveAssets([asset])}
        />
      )}

      <PhotoLightbox
        photos={visibleLightboxPhotos}
        initialIdx={lightboxIdx}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        downloadAction={{
          label: t("actions.saveOne"),
          busyLabel: t("actions.saving"),
          onClick: (_url, index) => {
            const asset = filteredAssets[index];
            if (asset) return saveAssets([asset]);
          },
        }}
      />
    </>
  );
}
