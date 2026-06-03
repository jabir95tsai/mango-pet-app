"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Reusable canvas confetti overlay — a single `<canvas>` running one of the
 * named particle effects from the user's Claude Design confetti engine
 * (`confetti-engine.jsx`). One rAF loop integrates whatever particles are
 * alive; the parent bumps `playToken` to fire a fresh burst. Portals to
 * <body> as a fixed, viewport-sized, pointer-events-none layer so it never
 * depends on (or is clipped by) the caller's box.
 *
 * Honors prefers-reduced-motion: spawns a single static, settled scatter and
 * draws ONE frame — no animation loop (design variant C).
 *
 * Shared by the walks goal-hit celebration and the §H badge-unlock modal —
 * pass `mode` / `palette` / `playToken` to retarget it. Colours are the
 * mango palette (aligned to shared-tokens / globals.css), never legacy.
 */

export type ConfettiMode = "paper" | "brand" | "leaves" | "burst" | "stardust";

// ── Mango palette (aligned to packages/shared-tokens + globals.css @theme) ──
const C = {
  brand: "#f39800",
  brandDeep: "#d77b00",
  amber: "#ffc25c",
  leaf: "#5fa858",
  success: "#7dd699",
  peach: "#ffb3ba",
  yellow: "#ffd24c",
  cookie: "#d77b3f",
};
const PARTY = [C.brand, C.amber, C.leaf, C.success, C.peach, C.yellow, C.brandDeep];
const LEAVES = [C.leaf, C.success, "#8cc24a", "#b6d98c", C.amber, C.cookie];
const GLOW = [C.amber, C.peach, C.success, C.yellow, "#fff6df"];
const BRAND_GLYPHS = ["🐾", "🦴", "🥭", "🐶"];

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0];

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

type BaseP = { x: number; y: number; age: number; delay: number; dead?: boolean };
type SpawnOpts = {
  palette?: string[];
  count?: number;
  origin?: { x: number; y: number };
};
type Effect = {
  spawn(W: number, H: number, reduced: boolean, opts?: SpawnOpts): BaseP[];
  step(p: BaseP, dt: number, W: number, H: number): void;
  draw(ctx: CanvasRenderingContext2D, p: BaseP): void;
};

// Per-effect particle shapes (cast inside each effect — the registry only
// promises BaseP, but each effect owns the full set it spawned).
type PaperP = BaseP & {
  vx: number; vy: number; rot: number; vrot: number; w: number; h: number;
  color: string; flip: number; flipPh: number;
  swayAmp: number; swayFreq: number; swayPh: number;
};
type BrandP = BaseP & {
  vx: number; vy: number; rot: number; vrot: number; size: number; glyph: string;
  swayAmp: number; swayFreq: number; swayPh: number;
};
type LeafP = BaseP & {
  baseX: number; vy: number; rot: number; vrot: number; size: number; color: string;
  swayAmp: number; swayFreq: number; swayPh: number;
};
type BurstP = BaseP & {
  vx: number; vy: number; rot: number; vrot: number; w: number; h: number; r: number;
  color: string; drag: number;
};
type DustP = BaseP & {
  vx: number; vy: number; r: number; color: string;
  tw: number; twPh: number; star: boolean; life: number; maxLife: number;
};

const EFFECTS: Record<ConfettiMode, Effect> = {
  // A — refined paper confetti: top-edge curtain, flutter + 3D card-flip.
  paper: {
    spawn(W, H, reduced, opts) {
      const cols = opts?.palette ?? PARTY;
      const n = reduced ? 16 : opts?.count ?? 64;
      const out: PaperP[] = [];
      for (let i = 0; i < n; i++) {
        const streamer = Math.random() < 0.22;
        out.push({
          x: rand(-10, W + 10),
          y: rand(-60, -8),
          vx: rand(-34, 34),
          vy: rand(70, 150),
          rot: rand(0, TAU),
          vrot: rand(-5, 5),
          w: streamer ? rand(3, 5) : rand(7, 12),
          h: streamer ? rand(16, 26) : rand(9, 15),
          color: pick(cols),
          flip: rand(4, 9),
          flipPh: rand(0, TAU),
          swayAmp: rand(14, 40),
          swayFreq: rand(1.2, 2.6),
          swayPh: rand(0, TAU),
          delay: reduced ? 0 : rand(0, 0.5),
          age: 0,
        });
      }
      if (reduced)
        out.forEach((p) => {
          p.y = rand(40, H * 0.5);
          p.vx = 0;
          p.vy = 0;
          p.vrot = 0;
        });
      return out;
    },
    step(p, dt) {
      const q = p as PaperP;
      q.vy += 360 * dt;
      q.x += (q.vx + Math.cos(q.swayPh + q.age * q.swayFreq) * q.swayAmp) * dt;
      q.y += q.vy * dt;
      q.rot += q.vrot * dt;
    },
    draw(ctx, p) {
      const q = p as PaperP;
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      const dw = Math.max(1, q.w * Math.abs(Math.cos(q.flipPh + q.age * q.flip)));
      ctx.fillStyle = q.color;
      roundRect(ctx, -dw / 2, -q.h / 2, dw, q.h, 1.5);
      ctx.fill();
      ctx.restore();
    },
  },

  // B — branded glyphs: paw / bone / mango / dog rain, tumble + pop-in.
  brand: {
    spawn(W, H, reduced) {
      const n = reduced ? 9 : 28;
      const out: BrandP[] = [];
      for (let i = 0; i < n; i++) {
        out.push({
          x: rand(16, W - 16),
          y: rand(-70, -10),
          vx: rand(-26, 26),
          vy: rand(60, 120),
          rot: rand(-0.5, 0.5),
          vrot: rand(-2.4, 2.4),
          size: rand(20, 34),
          glyph: pick(BRAND_GLYPHS),
          swayAmp: rand(10, 28),
          swayFreq: rand(1.4, 2.8),
          swayPh: rand(0, TAU),
          delay: reduced ? 0 : rand(0, 0.7),
          age: 0,
        });
      }
      if (reduced)
        out.forEach((p) => {
          p.y = rand(50, H * 0.55);
          p.vx = 0;
          p.vy = 0;
          p.vrot = 0;
        });
      return out;
    },
    step(p, dt) {
      const q = p as BrandP;
      q.vy += 300 * dt;
      q.x += (q.vx + Math.cos(q.swayPh + q.age * q.swayFreq) * q.swayAmp) * dt;
      q.y += q.vy * dt;
      q.rot += q.vrot * dt;
    },
    draw(ctx, p) {
      const q = p as BrandP;
      const pop = Math.min(1, q.age / 0.22);
      const s = q.size * (0.6 + 0.4 * (pop < 1 ? 1.25 - Math.abs(1 - pop) * 0.25 : 1));
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot * 0.5);
      ctx.font = `${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(q.glyph, 0, 0);
      ctx.restore();
    },
  },

  // C — leaves: pendulum drift, slow descent, tumbling leaf shapes.
  leaves: {
    spawn(W, H, reduced) {
      const n = reduced ? 12 : 32;
      const out: LeafP[] = [];
      for (let i = 0; i < n; i++) {
        const baseX = rand(0, W);
        out.push({
          baseX,
          x: baseX,
          y: rand(-60, -8),
          vy: rand(34, 70),
          rot: rand(0, TAU),
          vrot: rand(-1.3, 1.3),
          size: rand(9, 16),
          color: pick(LEAVES),
          swayAmp: rand(26, 60),
          swayFreq: rand(0.7, 1.5),
          swayPh: rand(0, TAU),
          delay: reduced ? 0 : rand(0, 0.8),
          age: 0,
        });
      }
      if (reduced)
        out.forEach((p) => {
          p.y = rand(40, H * 0.55);
          p.vy = 0;
          p.vrot = 0;
        });
      return out;
    },
    step(p, dt) {
      const q = p as LeafP;
      q.y += q.vy * dt;
      const s = Math.sin(q.swayPh + q.age * q.swayFreq);
      q.x = q.baseX + s * q.swayAmp;
      q.rot += (q.vrot + s * 1.4) * dt;
    },
    draw(ctx, p) {
      const q = p as LeafP;
      const s = q.size;
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.78, 0, 0, s);
      ctx.quadraticCurveTo(-s * 0.78, 0, 0, -s);
      ctx.fill();
      ctx.strokeStyle = "rgba(40,60,20,0.28)";
      ctx.lineWidth = Math.max(0.6, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(0, s * 0.85);
      ctx.stroke();
      ctx.restore();
    },
  },

  // D — center cannon: radial burst from the trophy, gravity + air drag.
  burst: {
    spawn(W, H, reduced, opts) {
      const cols = opts?.palette ?? PARTY;
      const n = reduced ? 22 : opts?.count ?? 94;
      const ox = W * (opts?.origin?.x ?? 0.5);
      const oy = H * (opts?.origin?.y ?? 0.3);
      const out: BurstP[] = [];
      for (let i = 0; i < n; i++) {
        const ang = rand(0, TAU);
        const spd = rand(160, 540) * (reduced ? 0.25 : 1);
        const circle = Math.random() < 0.4;
        out.push({
          x: ox,
          y: oy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - rand(40, 160),
          rot: rand(0, TAU),
          vrot: rand(-9, 9),
          w: circle ? 0 : rand(6, 11),
          h: circle ? 0 : rand(8, 15),
          r: circle ? rand(3, 6) : 0,
          color: pick(cols),
          drag: rand(0.86, 0.93),
          delay: 0,
          age: 0,
        });
      }
      if (reduced)
        out.forEach((p) => {
          p.vx *= 0.4;
          p.vy = Math.abs(p.vy) * 0.2;
        });
      return out;
    },
    step(p, dt) {
      const q = p as BurstP;
      q.vy += 620 * dt;
      const d = Math.pow(q.drag, dt * 60);
      q.vx *= d;
      q.vy *= d;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vrot * dt;
    },
    draw(ctx, p) {
      const q = p as BurstP;
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.fillStyle = q.color;
      if (q.r) {
        ctx.beginPath();
        ctx.arc(0, 0, q.r, 0, TAU);
        ctx.fill();
      } else {
        ctx.rotate(q.rot);
        const dw = Math.max(1, q.w * Math.abs(Math.cos(q.age * 7)));
        roundRect(ctx, -dw / 2, -q.h / 2, dw, q.h, 1.5);
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // E — soft stardust: glowing motes rise & twinkle around the trophy.
  stardust: {
    spawn(W, H, reduced, opts) {
      const cols = opts?.palette ?? GLOW;
      const n = reduced ? 16 : opts?.count ?? 50;
      const cx = W * (opts?.origin?.x ?? 0.5);
      const cy = H * (opts?.origin?.y ?? 0.32);
      const out: DustP[] = [];
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU);
        const radius = rand(8, 120);
        const life = rand(1.4, 2.6);
        out.push({
          x: cx + Math.cos(a) * radius,
          y: cy + Math.sin(a) * radius * 0.7,
          vx: rand(-12, 12),
          vy: rand(-26, -64),
          r: rand(1.6, 5.5),
          color: pick(cols),
          tw: rand(2.5, 6),
          twPh: rand(0, TAU),
          star: Math.random() < 0.22,
          life,
          maxLife: life,
          delay: reduced ? 0 : rand(0, 1.6),
          age: 0,
        });
      }
      if (reduced)
        out.forEach((p) => {
          p.vx = 0;
          p.vy = 0;
          p.life = 99;
        });
      return out;
    },
    step(p, dt) {
      const q = p as DustP;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 6 * dt;
      q.life -= dt;
      if (q.life <= 0) q.dead = true;
    },
    draw(ctx, p) {
      const q = p as DustP;
      const tw = 0.55 + 0.45 * Math.sin(q.twPh + q.age * q.tw);
      const fade =
        q.maxLife > 5
          ? 1
          : Math.min(1, q.life / 0.5) * Math.min(1, q.age / 0.3 + 0.1);
      const alpha = Math.max(0, Math.min(1, tw * fade));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r * 3.2);
      g.addColorStop(0, q.color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r * 3.2, 0, TAU);
      ctx.fill();
      if (q.star) {
        ctx.strokeStyle = q.color;
        ctx.globalAlpha = alpha * 0.9;
        ctx.lineWidth = 1;
        const L = q.r * 3.4;
        ctx.beginPath();
        ctx.moveTo(q.x - L, q.y);
        ctx.lineTo(q.x + L, q.y);
        ctx.moveTo(q.x, q.y - L);
        ctx.lineTo(q.x, q.y + L);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
};

type Sim = {
  particles: BaseP[];
  raf: number;
  last: number;
  reduced: boolean;
  w: number;
  h: number;
  dpr: number;
  frame?: (ts: number) => void;
};

export function ConfettiCanvas({
  mode = "paper",
  playToken = 0,
  palette,
  count,
  origin,
  zIndex = 50,
  portal = true,
}: {
  mode?: ConfettiMode;
  /** Bump to fire a fresh burst (mount already fires the first one). */
  playToken?: number;
  palette?: string[];
  count?: number;
  origin?: { x: number; y: number };
  zIndex?: number;
  /** Portal to <body> as a fixed viewport overlay (default). Set false to
   *  render inline (absolute) inside a positioned ancestor — e.g. the
   *  celebration modal, where confetti must sit between the scrim and the
   *  card. Still sizes to the window. */
  portal?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const sim = useRef<Sim>({
    particles: [],
    raf: 0,
    last: 0,
    reduced: false,
    w: 0,
    h: 0,
    dpr: 1,
  });

  // Set up the canvas + rAF loop. Re-runs only when the effect changes.
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const s = sim.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      s.w = window.innerWidth;
      s.h = window.innerHeight;
      cv.width = s.w * s.dpr;
      cv.height = s.h * s.dpr;
    };
    resize();

    const frame = (ts: number) => {
      const dt = s.last ? Math.min(0.05, (ts - s.last) / 1000) : 0.016;
      s.last = ts;
      const eff = EFFECTS[mode] ?? EFFECTS.paper;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      const alive: BaseP[] = [];
      for (const p of s.particles) {
        if (p.delay > 0) {
          p.delay -= dt;
          alive.push(p);
          continue;
        }
        p.age += dt;
        eff.step(p, dt, s.w, s.h);
        const off = p.y > s.h + 40 || p.x < -60 || p.x > s.w + 60;
        if (!p.dead && !(off && !s.reduced)) {
          eff.draw(ctx, p);
          alive.push(p);
        }
      }
      s.particles = alive;
      // reduced-motion: draw the settled scatter once, then stop (no loop).
      if (alive.length > 0 && !s.reduced) {
        s.raf = requestAnimationFrame(frame);
      } else {
        s.raf = 0;
      }
    };
    s.frame = frame;
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [mode]);

  // Fire a burst on mount and whenever playToken / mode changes.
  useEffect(() => {
    const s = sim.current;
    const eff = EFFECTS[mode] ?? EFFECTS.paper;
    s.particles = eff.spawn(s.w, s.h, s.reduced, { palette, count, origin });
    if (!s.raf && s.frame) {
      s.last = 0;
      s.raf = requestAnimationFrame(s.frame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playToken, mode]);

  if (typeof document === "undefined") return null;

  const canvas = (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: portal ? "fixed" : "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex,
      }}
    />
  );

  return portal ? createPortal(canvas, document.body) : canvas;
}
