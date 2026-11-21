"use client";

import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { isScopedPhoto, readPhotoBlob } from "@/lib/firebase/storage";

export function ScopedPhoto({ src, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const [photo, setPhoto] = useState<{ path: string; url: string }>();
  useEffect(() => {
    if (!isScopedPhoto(src)) return;
    let active = true;
    let url: string | undefined;
    readPhotoBlob(src).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setPhoto({ path: src, url });
    }).catch(() => {});
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);
  const url = isScopedPhoto(src) ? (photo?.path === src ? photo.url : undefined) : src;
  return <img {...props} src={url} />;
}
