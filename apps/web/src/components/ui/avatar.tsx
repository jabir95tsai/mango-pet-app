"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  alt?: string;
  name?: string | null;
  size?: number;
  className?: string;
};

function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(seed: string | null | undefined): string {
  const palette = [
    "bg-amber-200 text-amber-900",
    "bg-rose-200 text-rose-900",
    "bg-emerald-200 text-emerald-900",
    "bg-sky-200 text-sky-900",
    "bg-violet-200 text-violet-900",
    "bg-orange-200 text-orange-900",
  ];
  if (!seed) return palette[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function Avatar({ src, alt, name, size = 40, className }: Props) {
  const px = `${size}px`;
  const fontSize = size > 48 ? "text-lg" : size > 32 ? "text-sm" : "text-xs";

  return (
    <div
      style={{ width: px, height: px }}
      className={cn(
        "relative rounded-full overflow-hidden grid place-items-center font-semibold shrink-0",
        !src && colorFor(name ?? alt),
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt ?? name ?? ""}
          fill
          sizes={px}
          className="object-cover"
          unoptimized
        />
      ) : (
        <span className={fontSize}>{initialsOf(name ?? alt)}</span>
      )}
    </div>
  );
}
