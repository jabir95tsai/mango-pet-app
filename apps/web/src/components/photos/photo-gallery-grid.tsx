"use client";

import type { GalleryPhotoAsset } from "@/lib/types";
import { PhotoAssetCard } from "./photo-asset-card";

type Props = {
  assets: GalleryPhotoAsset[];
  downloadedIds: Set<string>;
  selectedIds: Set<string>;
  savingIds: Set<string>;
  onOpen: (asset: GalleryPhotoAsset) => void;
  onToggleSelected: (assetId: string) => void;
  onSave: (asset: GalleryPhotoAsset) => void;
};

export function PhotoGalleryGrid({
  assets,
  downloadedIds,
  selectedIds,
  savingIds,
  onOpen,
  onToggleSelected,
  onSave,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {assets.map((asset) => (
        <PhotoAssetCard
          key={asset.id}
          asset={asset}
          downloaded={downloadedIds.has(asset.id)}
          selected={selectedIds.has(asset.id)}
          saving={savingIds.has(asset.id)}
          onOpen={() => onOpen(asset)}
          onToggleSelected={() => onToggleSelected(asset.id)}
          onSave={() => onSave(asset)}
        />
      ))}
    </div>
  );
}
