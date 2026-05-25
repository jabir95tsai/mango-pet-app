"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Full-screen photo viewer for feed posts + walk recap photos. Lives at
 * `z-[99]` (above the mobile nav at z-30 and the tracking-view at z-50)
 * via a portal to `document.body`. Three ways to dismiss: tap the dark
 * backdrop, the top-right X, or swipe the image down past the threshold
 * (image fades + translates with the finger, snaps closed once released
 * past `SWIPE_V_CLOSE_THRESHOLD`).
 *
 * Carousel:
 *   - Single flex track with each photo at `100%` of viewport width;
 *     `translate3d` based on `currentIdx`. While the finger / mouse is
 *     down, the track follows the drag 1:1 (no transition); on release,
 *     it snaps to the next slot (300ms ease).
 *   - Dots indicator + counter only render when `photos.length > 1`.
 *
 * Keyboard:
 *   - Escape closes
 *   - ArrowLeft / ArrowRight move between photos (no-op on first/last)
 *   - Tab cycles focus inside the dialog (basic focus trap)
 *
 * Reduced motion:
 *   - `prefers-reduced-motion: reduce` detected via matchMedia →
 *     carousel + fade transitions disabled, photos snap instantly.
 *     Vertical swipe still works (it's UI feedback, not animation).
 */
type Props = {
  /** Resolved URLs (caller has already merged previewUrl ?? uploadedUrl). */
  photos: string[];
  /** Index to open at — index out of range clamps to 0. */
  initialIdx: number;
  open: boolean;
  onClose: () => void;
};

type Drag = {
  active: boolean;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  /** Axis is committed after the first 8px movement so a tap-with-jitter
   *  doesn't accidentally trigger close/carousel. */
  axis: "horizontal" | "vertical" | null;
};

const NO_DRAG: Drag = {
  active: false,
  startX: 0,
  startY: 0,
  dx: 0,
  dy: 0,
  axis: null,
};

/** Beyond this horizontal travel on touchend, snap to the neighbouring
 *  photo. Tuned so a light flick goes through without needing to drag a
 *  full half-screen. */
const SWIPE_H_THRESHOLD = 50;
/** Beyond this downward travel on touchend, close. 100px gives enough
 *  room to start a swipe and bail out before committing. */
const SWIPE_V_CLOSE_THRESHOLD = 100;

export function PhotoLightbox({ photos, initialIdx, open, onClose }: Props) {
  const t = useTranslations("PhotoLightbox");
  const [currentIdx, setCurrentIdx] = useState(initialIdx);
  const [drag, setDrag] = useState<Drag>(NO_DRAG);
  const [reducedMotion, setReducedMotion] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // True for the synthetic click that fires right after a touch/mouse
  // drag that committed an axis (carousel swipe / vertical swipe-to-close).
  // Without this guard, swiping between photos lands on `touchend` which
  // immediately triggers the synthesized `click` event — and the click
  // handler's "target === currentTarget" backdrop-dismiss check would
  // close the lightbox the user was trying to swipe inside.
  const wasDraggingRef = useRef(false);

  // Clamp + sync incoming initialIdx whenever a NEW lightbox session
  // starts (open transitions false→true OR initialIdx changes).
  useEffect(() => {
    if (!open) return;
    const safe = Math.max(0, Math.min(photos.length - 1, initialIdx));
    setCurrentIdx(safe);
    setDrag(NO_DRAG);
  }, [open, initialIdx, photos.length]);

  // prefers-reduced-motion detection. Listened so user toggling at OS
  // level mid-session updates without needing a reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Focus mgmt — remember the element that owned focus, drive focus to
  // the close button on open, restore on close. Without restore the
  // user lands at body top after closing on iOS.
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      const id = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    const el = restoreFocusRef.current;
    if (el && typeof el.focus === "function") el.focus();
  }, [open]);

  // Body scroll lock while open. Mirrors the WalkTrackingView pattern.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Keyboard nav + close. Listener mounted only while open so dialogs
  // elsewhere keep their key shortcuts unfettered.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (photos.length <= 1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIdx((i) => Math.min(photos.length - 1, i + 1));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, photos.length, onClose]);

  // Focus trap — Tab cycles inside dialog. Lightweight implementation:
  // queries all focusable descendants of the close button's ancestor
  // dialog on each Tab so we don't need to track them across renders.
  useEffect(() => {
    if (!open) return;
    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const dialog = closeBtnRef.current?.closest('[role="dialog"]');
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, [open]);

  function startDrag(x: number, y: number) {
    setDrag({ active: true, startX: x, startY: y, dx: 0, dy: 0, axis: null });
  }

  function moveDrag(x: number, y: number) {
    setDrag((d) => {
      if (!d.active) return d;
      const dx = x - d.startX;
      const dy = y - d.startY;
      let axis = d.axis;
      // Dead zone — pick the dominant axis after 8px of travel.
      if (axis === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        axis = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      return { ...d, dx, dy, axis };
    });
  }

  function endDrag() {
    setDrag((d) => {
      if (!d.active) return d;
      if (d.axis !== null) {
        // A drag actually committed — suppress the synthetic click
        // that browsers fire right after touchend / mouseup. Clear on
        // the next tick so the very next user gesture works normally.
        wasDraggingRef.current = true;
        setTimeout(() => {
          wasDraggingRef.current = false;
        }, 0);
      }
      if (d.axis === "horizontal" && photos.length > 1) {
        if (d.dx < -SWIPE_H_THRESHOLD) {
          setCurrentIdx((i) => Math.min(photos.length - 1, i + 1));
        } else if (d.dx > SWIPE_H_THRESHOLD) {
          setCurrentIdx((i) => Math.max(0, i - 1));
        }
      } else if (d.axis === "vertical" && d.dy > SWIPE_V_CLOSE_THRESHOLD) {
        onClose();
      }
      return NO_DRAG;
    });
  }

  if (!open || typeof document === "undefined" || photos.length === 0) {
    return null;
  }

  // Track positioning: base = -currentIdx * 100%, plus the in-flight
  // horizontal drag delta. While dragging horizontally we skip the
  // transition so the photo follows the finger 1:1.
  const horizontalOffsetPx = drag.axis === "horizontal" ? drag.dx : 0;
  // Vertical drag (downward only) — both translates the whole overlay
  // AND fades it. Upward drag is ignored (no swipe-up close).
  const verticalOffsetPx =
    drag.axis === "vertical" && drag.dy > 0 ? drag.dy : 0;
  // Opacity ramps from 1 → 0.5 over the first 400px of downward travel
  // so the close gesture has clear visual feedback.
  const fadeOpacity = Math.max(0.5, 1 - verticalOffsetPx / 400);

  const isDragging = drag.active && drag.axis !== null;
  const transitionRule = reducedMotion
    ? "none"
    : isDragging
      ? "none"
      : "transform 300ms ease, opacity 200ms ease";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        photos.length > 1
          ? t("counter", { current: currentIdx + 1, total: photos.length })
          : t("close")
      }
      className="fixed inset-0 z-[99] flex items-center justify-center bg-black/90"
      style={{
        opacity: fadeOpacity,
        transform: `translate3d(0, ${verticalOffsetPx}px, 0)`,
        transition: transitionRule,
      }}
      onClick={(e) => {
        // Tap on the bare overlay closes. Per-photo wrapper applies
        // the same check (the wrapper, not this element, is what
        // receives the click when the user taps the dark margin
        // around an `object-contain` image, because the wrapper
        // fills the viewport).
        if (e.target === e.currentTarget && !wasDraggingRef.current) {
          onClose();
        }
      }}
      onTouchStart={(e) => {
        const t0 = e.touches[0];
        startDrag(t0.clientX, t0.clientY);
      }}
      onTouchMove={(e) => {
        const t0 = e.touches[0];
        moveDrag(t0.clientX, t0.clientY);
      }}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        startDrag(e.clientX, e.clientY);
      }}
      onMouseMove={(e) => {
        if (!drag.active) return;
        moveDrag(e.clientX, e.clientY);
      }}
      onMouseUp={endDrag}
      onMouseLeave={() => {
        if (drag.active) endDrag();
      }}
    >
      {/* Carousel track */}
      <div
        className="flex h-full w-full"
        style={{
          transform: `translate3d(calc(${-currentIdx * 100}% + ${horizontalOffsetPx}px), 0, 0)`,
          transition: transitionRule,
        }}
      >
        {photos.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="flex h-full w-full shrink-0 items-center justify-center p-4"
            onClick={(e) => {
              // Wrapper fills the viewport; a tap on the dark margin
              // around an `object-contain` image lands here, not on
              // the outer overlay. Close on bare-wrapper taps using
              // the same target-identity trick the outer uses, and
              // suppress the synthetic click that follows a swipe.
              if (e.target === e.currentTarget && !wasDraggingRef.current) {
                onClose();
              }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              draggable={false}
              className="max-h-full max-w-full select-none object-contain"
            />
          </div>
        ))}
      </div>

      {/* Top-right close button */}
      <button
        ref={closeBtnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={t("close")}
        className="absolute right-4 z-10 grid size-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{ top: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <X className="size-5" />
      </button>

      {/* Bottom indicator strip — only for multi-photo */}
      {photos.length > 1 && (
        <div
          className="absolute inset-x-0 z-10 flex flex-col items-center gap-2.5 px-4 text-white"
          style={{ bottom: "max(env(safe-area-inset-bottom), 1.5rem)" }}
        >
          <p
            aria-live="polite"
            className="text-xs font-medium tabular-nums opacity-80"
          >
            {t("counter", {
              current: currentIdx + 1,
              total: photos.length,
            })}
          </p>
          <div
            className="flex items-center gap-2"
            role="tablist"
            aria-label={t("counter", {
              current: currentIdx + 1,
              total: photos.length,
            })}
          >
            {photos.map((_, i) => {
              const active = i === currentIdx;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIdx(i);
                  }}
                  aria-label={
                    active
                      ? t("counter", {
                          current: i + 1,
                          total: photos.length,
                        })
                      : i < currentIdx
                        ? t("prev")
                        : t("next")
                  }
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    active ? "w-5 bg-mango-brand" : "w-2 bg-white/40 hover:bg-white/70",
                  )}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
