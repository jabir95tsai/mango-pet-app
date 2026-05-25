"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Image as ImageIcon, Loader2, X, Globe, Users, Lock } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FieldLabel } from "@/components/ui/select";
import { SaveToAlbumButton } from "@/components/ui/save-to-album-button";
import { createPost } from "@/lib/firebase/posts";
import { useAuth } from "@/components/auth/auth-provider";
import { IMAGE_PRESETS, processImage } from "@/lib/image-processing";
import type { Pet, Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  pets: Pet[];
  onCreated?: () => void;
  /** Pre-load the composer with a single photo (e.g., from the
   *  walks auto-photo-share start/end prompt). Counts against the
   *  MAX_PHOTOS limit but the user can still add more or remove this
   *  one. Spec docs/features/walks-auto-photo-share.md flows A + B. */
  initialPhoto?: File;
  /** Pre-fill the caption — typically "Mango 開始遛狗 🐾" or similar.
   *  User can still edit before submitting. */
  initialCaption?: string;
  /** Cross-link the resulting post to walks/{walkId}. Threaded into
   *  createPost which writes it to post.walkId. Absent on the
   *  freehand-compose path so legacy posts stay untouched. */
  walkId?: string;
};

const MAX_PHOTOS = 4;

const VISIBILITY_OPTIONS: { value: Visibility; icon: typeof Globe; labelKey: string }[] = [
  { value: "public", icon: Globe, labelKey: "visibilityPublic" },
  { value: "friends", icon: Users, labelKey: "visibilityFriends" },
  { value: "private", icon: Lock, labelKey: "visibilityPrivate" },
];

export function PostComposer({
  open,
  onClose,
  pets,
  onCreated,
  initialPhoto,
  initialCaption,
  walkId,
}: Props) {
  const tCommon = useTranslations("Common");
  const tP = useTranslations("Post");
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // Default visibility: 'public' per docs/features/ui-polish-bundle-
  // 2026-05-25.md Item #3 — user wants 分享預設公開. Manual switch via
  // the visibility chips below still respected for any individual post.
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Pre-fills from the walks auto-photo-share flow. Caller can
      // omit either prop independently — caption-only pre-fill is
      // valid (e.g., future "share my pet's profile" flow), and so
      // is photo-only. The freehand-compose path passes neither and
      // we reset everything to empty as before.
      setText(initialCaption ?? "");
      setPhotos(initialPhoto ? [initialPhoto] : []);
      setPreviews([]);
      setVisibility("public");
      setSelectedPets([]);
      setProcessing(false);
      setError(null);
    }
    // initialPhoto / initialCaption are stable per `open` toggle in
    // practice (caller mounts the composer with one file then
    // unmounts), so omitting them from deps avoids resetting state
    // mid-edit if the parent re-renders with new prop identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  function togglePet(petId: string) {
    setSelectedPets((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId],
    );
  }

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (newFiles.length === 0) return;

    setProcessing(true);
    setError(null);
    try {
      const room = MAX_PHOTOS - photos.length;
      const accepted = newFiles.slice(0, room);
      const processed = await Promise.all(
        accepted.map((f) => processImage(f, IMAGE_PRESETS.post)),
      );
      setPhotos((prev) => [...prev, ...processed].slice(0, MAX_PHOTOS));
    } catch (err) {
      setError(err instanceof Error ? err.message : "圖片處理失敗");
    } finally {
      setProcessing(false);
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!user) return;
    if (!text.trim() && photos.length === 0) {
      setError(tP("needTextOrPhoto"));
      return;
    }
    setPosting(true);
    setError(null);
    try {
      await createPost({
        authorUid: user.uid,
        authorName: user.displayName ?? "Friend",
        authorPhotoURL: user.photoURL,
        petIds: selectedPets,
        text: text.trim(),
        visibility,
        photoURLs: [],
        photos,
        // Cross-link to the walk that triggered this post (auto-photo-
        // share flow). Absent for freehand compose — createPost skips
        // the field when undefined so legacy posts stay untouched.
        walkId,
      });
      onCreated?.();
      onClose();
    } catch (err) {
      // createPost throws a partial-success error with .partial when some
      // photos uploaded — treat that as success-with-warning rather than failure.
      const partial = (err as { partial?: unknown }).partial;
      if (partial) {
        onCreated?.();
        setError(err instanceof Error ? err.message : "Partial post");
        // Close after a brief moment so the user can read the warning.
        setTimeout(() => onClose(), 1800);
      } else {
        setError(err instanceof Error ? err.message : "Post failed");
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={tP("compose")}>
      <div className="flex flex-col gap-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tP("placeholder")}
          rows={4}
        />

        {previews.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {previews.map((url, i) => (
              <div
                key={`${photos[i]?.name ?? i}-${i}`}
                className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100"
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="200px"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label="移除照片"
                  className="absolute top-1 right-1 size-8 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                >
                  <X className="size-4" />
                </button>
                {/* Per-photo save-to-album — bottom-right so close X
                    stays prominent. Spec: each photo in a multi-pick
                    composer gets its own button (Web Share API takes
                    one file at a time; batch save was rejected in
                    "不在這次範圍"). */}
                {photos[i] && (
                  <SaveToAlbumButton
                    file={photos[i]}
                    className="absolute bottom-1 right-1 size-8"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={handleAddPhotos}
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={photos.length >= MAX_PHOTOS || processing}
          >
            {processing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImageIcon className="size-4" />
            )}
            {photos.length}/{MAX_PHOTOS}
          </Button>
          {processing && (
            <span className="text-xs text-amber-600">處理照片中…</span>
          )}
        </div>

        {pets.length > 0 && (
          <div className="flex flex-col gap-2">
            <FieldLabel>{tP("tagPet")}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {pets.map((p) => {
                const on = selectedPets.includes(p.petId);
                return (
                  <button
                    key={p.petId}
                    type="button"
                    onClick={() => togglePet(p.petId)}
                    className={cn(
                      "px-3 h-8 rounded-full text-xs font-medium transition-colors",
                      on
                        ? "bg-amber-500 text-white"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                    )}
                  >
                    🐾 {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <FieldLabel>{tP("visibility")}</FieldLabel>
          <div className="flex gap-2">
            {VISIBILITY_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => setVisibility(value)}
                aria-pressed={visibility === value}
                className={cn(
                  "flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium transition-colors",
                  visibility === value
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200",
                )}
              >
                <Icon className="size-3.5" />
                {tP(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={posting}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={posting || processing}>
            {posting ? "..." : tP("publish")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
