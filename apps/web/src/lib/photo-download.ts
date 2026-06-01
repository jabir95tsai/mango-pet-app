import type { PhotoDownloadMode } from "@/lib/types";

export type PhotoDownloadRequest = {
  id: string;
  url: string;
  fileName: string;
  title?: string;
};

export type SinglePhotoDownloadResult = {
  ok: boolean;
  mode?: PhotoDownloadMode;
  reason?: "dismissed" | "fetch-failed" | "share-failed" | "download-failed";
};

export type MultiPhotoDownloadResult = {
  completedAssetIds: string[];
  cancelled: boolean;
  mode: PhotoDownloadMode;
  failures: { id: string; reason: string }[];
};

type PreparedPhoto = PhotoDownloadRequest & {
  file: File;
};

function canShareFiles(files: File[]): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

/**
 * Whether to route a save through the OS share sheet (`navigator.share`)
 * instead of a direct file download.
 *
 * Web Share is the ONLY way into the iOS/Android photo album (an
 * `<a download>` lands in Files, not Photos), so on touch devices we
 * prefer it. But desktop Chrome/Edge now also report `canShare({files})`
 * === true, and there the share sheet is the WRONG behaviour for a
 * "download" button: it opens an OS share dialog (and frequently rejects
 * with AbortError once the pre-fetch await has consumed the click's
 * transient activation), so no file is ever saved. Gate share on a
 * touch-primary (coarse pointer) device; everyone else gets a real
 * download.
 */
function prefersShareSheet(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(pointer: coarse)").matches;
}

function extensionFromType(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("heic")) return "heic";
  return "jpg";
}

function normalizeFileName(fileName: string, type: string): string {
  if (/\.[a-z0-9]{2,5}$/i.test(fileName)) return fileName;
  return `${fileName}.${extensionFromType(type)}`;
}

async function fetchPhotoFile(
  url: string,
  fileName: string,
): Promise<File> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) {
    throw new Error(`Photo fetch failed: ${res.status}`);
  }
  const blob = await res.blob();
  const type = blob.type || "image/jpeg";
  return new File([blob], normalizeFileName(fileName, type), { type });
}

function downloadFile(file: File): void {
  const objectUrl = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function shareFiles(files: File[], title: string): Promise<SinglePhotoDownloadResult> {
  if (!prefersShareSheet() || !canShareFiles(files)) {
    for (const file of files) downloadFile(file);
    return { ok: true, mode: "download" };
  }

  try {
    await navigator.share({ files, title });
    return { ok: true, mode: "share" };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, reason: "dismissed" };
    }
    return { ok: false, reason: "share-failed" };
  }
}

export async function downloadPhotoFromUrl(
  url: string,
  fileName: string,
): Promise<SinglePhotoDownloadResult> {
  try {
    const file = await fetchPhotoFile(url, fileName);
    downloadFile(file);
    return { ok: true, mode: "download" };
  } catch {
    return { ok: false, reason: "download-failed" };
  }
}

export async function shareOrDownloadPhotoFromUrl(
  url: string,
  fileName: string,
  title = "Mango Pet",
): Promise<SinglePhotoDownloadResult> {
  let file: File;
  try {
    file = await fetchPhotoFile(url, fileName);
  } catch {
    return { ok: false, reason: "fetch-failed" };
  }
  return shareFiles([file], title);
}

export async function shareOrDownloadPhotosFromUrls(
  photos: PhotoDownloadRequest[],
  title = "Mango Pet",
): Promise<MultiPhotoDownloadResult> {
  const prepared: PreparedPhoto[] = [];
  const failures: { id: string; reason: string }[] = [];

  for (const photo of photos) {
    try {
      prepared.push({
        ...photo,
        file: await fetchPhotoFile(photo.url, photo.fileName),
      });
    } catch {
      failures.push({ id: photo.id, reason: "fetch-failed" });
    }
  }

  if (prepared.length === 0) {
    return {
      completedAssetIds: [],
      cancelled: false,
      mode: "download",
      failures,
    };
  }

  const files = prepared.map((photo) => photo.file);
  if (prefersShareSheet() && canShareFiles(files)) {
    const shared = await shareFiles(files, title);
    return {
      completedAssetIds: shared.ok ? prepared.map((photo) => photo.id) : [],
      cancelled: shared.reason === "dismissed",
      mode: shared.mode ?? "share",
      failures,
    };
  }

  const completedAssetIds: string[] = [];
  let mode: PhotoDownloadMode = "download";

  for (const photo of prepared) {
    const result = await shareFiles([photo.file], photo.title ?? title);
    if (result.ok) {
      completedAssetIds.push(photo.id);
      mode = result.mode ?? mode;
      continue;
    }
    if (result.reason === "dismissed") {
      return {
        completedAssetIds,
        cancelled: true,
        mode,
        failures,
      };
    }
    failures.push({ id: photo.id, reason: result.reason ?? "share-failed" });
  }

  return {
    completedAssetIds,
    cancelled: false,
    mode,
    failures,
  };
}
