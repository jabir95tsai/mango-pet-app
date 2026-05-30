"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Pet avatar — uses `pet.photoURL` (real user-uploaded photo) when
 * present, else falls back to a brand-tint disc with the pet's name
 * initial + a small paw icon overlay (Q? from pets-v2 review — we want
 * the page to feel like "my pet" not stock illustration).
 *
 * NOT a port of the prototype's cartoon PetAvatar — that lived in a
 * design-only canvas where every pet was either Mango (shiba) or Coco
 * (frenchie). Real users upload their own pets.
 *
 * Sizes via inline width/height so the same component can render at the
 * 64px header, 34px switcher row, 96px empty-state hero, etc.
 */
type Props = {
  photoURL?: string | null;
  name: string;
  size?: number;
  className?: string;
};

function firstChar(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "🐾";
  // Use the first character (works for Chinese names: "Mango" → "M",
  // "芒果" → "芒"). Array spread handles surrogate pairs / emoji.
  return [...trimmed][0];
}

export function PetAvatar({ photoURL, name, size = 64, className }: Props) {
  const [errored, setErrored] = useState(false);
  const showImage = !!photoURL && !errored;
  const px = `${size}px`;

  // Initial font scales with avatar size; the 64px header avatar uses
  // ~26px text, the 34px switcher row uses ~14px.
  const fontPx = Math.round(size * 0.42);

  return (
    <div
      style={{ width: px, height: px, borderRadius: Math.round(size * 0.34) }}
      className={cn(
        "relative shrink-0 overflow-hidden",
        !showImage && "grid place-items-center bg-mango-brand-tint",
        className,
      )}
      aria-label={name}
    >
      {showImage ? (
        <Image
          src={photoURL!}
          alt={name}
          fill
          sizes={px}
          className="object-cover"
          unoptimized
          onError={() => setErrored(true)}
        />
      ) : (
        <>
          <span
            aria-hidden="true"
            className="font-extrabold leading-none text-mango-brand-deep"
            style={{ fontSize: `${fontPx}px`, letterSpacing: "-0.02em" }}
          >
            {firstChar(name)}
          </span>
          {/* Paw icon overlay — only renders at the bigger sizes
              (≥48px) where it's legible; at 34px it would crowd the
              initial. */}
          {size >= 48 && (
            <span
              aria-hidden="true"
              className="absolute right-1 bottom-1 grid size-4 place-items-center rounded-full bg-white/90 text-mango-brand-deep shadow-sm"
            >
              <svg
                width={10}
                height={10}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <ellipse cx="6.5" cy="9" rx="1.8" ry="2.3" />
                <ellipse cx="17.5" cy="9" rx="1.8" ry="2.3" />
                <ellipse cx="9.5" cy="5.5" rx="1.6" ry="2.1" />
                <ellipse cx="14.5" cy="5.5" rx="1.6" ry="2.1" />
                <path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z" />
              </svg>
            </span>
          )}
        </>
      )}
    </div>
  );
}
