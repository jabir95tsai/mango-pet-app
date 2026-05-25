// Walks screen — redesigned for iPhone. Two states: incomplete + complete.
// Mango palette from mango_pet_app/patches/globals.css.

const MP = {
  bg: '#fbf1dd',
  bgAlt: '#f6e7c8',
  card: '#ffffff',
  cardSoft: '#fff8e8',
  hairline: '#eadfc4',
  ink: '#231b14',
  ink2: '#5a4a38',
  ink3: '#9a8a74',
  brand: '#f39800',
  brandDeep: '#d77b00',
  brandTint: '#ffe7bf',
  amber: '#ffc25c',
  leaf: '#5fa858',
  leafDeep: '#3f8a3a',
  leafTint: '#e7f2dc',
  success: '#7dd699',
  cookie: '#d77b3f',
  cookieTint: '#ffe0cc',
  peach: '#ffb3ba',
  peachTint: '#ffe4e6'
};

const SF = '-apple-system, "SF Pro Text", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif';
const SFD = '-apple-system, "SF Pro Display", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif';

// ── Icons (1.5px stroke, inherits color via currentColor) ─────────
const Icon = {
  paw: (s = 18) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <ellipse cx="6.5" cy="9" rx="1.8" ry="2.3" />
      <ellipse cx="17.5" cy="9" rx="1.8" ry="2.3" />
      <ellipse cx="9.5" cy="5.5" rx="1.6" ry="2.1" />
      <ellipse cx="14.5" cy="5.5" rx="1.6" ry="2.1" />
      <path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z" />
    </svg>,

  play: (s = 20) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.5v13c0 .8.9 1.3 1.5.9l10-6.5c.6-.4.6-1.4 0-1.8l-10-6.5C8.9 4.2 8 4.7 8 5.5z" />
    </svg>,

  flame: (s = 14) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2s-1 3-3 5-3 4-3 7a6 6 0 1 0 12 0c0-2-1-3-2-4 0 2-1 3-2 3 0-3-2-6-2-11z" />
    </svg>,

  check: (s = 18) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7" />
    </svg>,

  plus: (s = 18) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>,

  hand: (s = 16) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V5a1.5 1.5 0 113 0v6" />
      <path d="M11 11V4a1.5 1.5 0 113 0v7" />
      <path d="M14 11V5a1.5 1.5 0 113 0v8" />
      <path d="M17 9a1.5 1.5 0 113 0v6a6 6 0 01-6 6h-2c-2 0-3-1-4-2l-4-5c-.5-1 0-2 1-2s2 .5 3 2" />
    </svg>,

  chev: (s = 14) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>,

  trophy: (s = 16) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4h10v2h3v3c0 2.2-1.8 4-4 4-.6 1.7-2 3-3.7 3.4V19h3v2H8v-2h3v-2.6C9.3 16 7.9 14.7 7.3 13c-2.2 0-4-1.8-4-4V6h3V4zm0 4H5v1c0 1.1.9 2 2 2V8zm10 0v3c1.1 0 2-.9 2-2V8h-2z" />
    </svg>,

  route: (s = 16) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.5 5h6a3.5 3.5 0 010 7h-5a3.5 3.5 0 000 7h6" />
    </svg>,

  clock: (s = 16) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>,

  star: (s = 16) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3 6.5 7 .8-5.2 4.9 1.4 6.9L12 17.5 5.8 21l1.4-6.9L2 9.3l7-.8z" />
    </svg>,

  // Tab bar icons
  tabHome: (s = 24, filled) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7">
      <path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2v-9z" strokeLinejoin="round" />
    </svg>,

  tabFeed: (s = 24, filled) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7">
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M7 9h10M7 13h6" strokeLinecap="round" />
    </svg>,

  tabBoard: (s = 24, filled) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V12M12 19V5M20 19v-9" />
    </svg>,

  tabMore: (s = 24) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
    </svg>

};

// ── Radial dial — the hero ─────────────────────────────────────────
function Dial({ percent, complete, doneMin, goalMin, pet }) {
  const R = 96;
  const STROKE = 14;
  const C = 2 * Math.PI * R;
  const dash = C * Math.min(1, percent / 100);
  const ringColor = complete ? MP.leaf : MP.brand;
  const bgRing = complete ? '#e7f2dc' : '#f7e4c5';

  return (
    <div style={{ position: 'relative', width: 232, height: 232, margin: '0 auto' }}>
      {/* outer celebration glow when complete */}
      {complete &&
      <div style={{
        position: 'absolute', inset: -10, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(95,168,88,0.18) 0%, rgba(95,168,88,0) 65%)'
      }} />
      }
      <svg width="232" height="232" viewBox="0 0 232 232" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="116" cy="116" r={R} fill="none" stroke={bgRing} strokeWidth={STROKE} />
        <circle
          cx="116" cy="116" r={R}
          fill="none" stroke={ringColor} strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          style={{ transition: 'stroke-dasharray 600ms ease' }} />
        
        {/* tick at top */}
        <circle cx="116" cy={116 - R} r="3" fill={MP.card} stroke={MP.hairline} strokeWidth="1.5" />
      </svg>

      {/* center: pet avatar */}
      <div style={{
        position: 'absolute', inset: 28, borderRadius: '50%',
        background: complete ?
        `linear-gradient(180deg, #fff7e0 0%, #ffeec2 100%)` :
        `linear-gradient(180deg, #ffe9b8 0%, #ffcf75 100%)`,
        boxShadow: 'inset 0 -8px 20px rgba(120,70,0,0.10), inset 0 2px 6px rgba(255,255,255,0.6)',
        display: 'grid', placeItems: 'center', overflow: 'hidden'
      }}>
        <PetAvatar complete={complete} />
        {complete &&
        <div style={{
          position: 'absolute', right: 8, bottom: 8,
          width: 38, height: 38, borderRadius: '50%',
          background: MP.leaf, color: '#fff',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 6px 14px -4px rgba(63,138,58,0.55), 0 0 0 4px ' + MP.card
        }}>
            {Icon.check(20)}
          </div>
        }
      </div>

      {/* numeric overlay on the ring (right side) */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: -6, textAlign: 'center'
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'baseline', gap: 4,
          padding: '6px 14px', borderRadius: 999,
          background: MP.card, border: `1px solid ${MP.hairline}`,
          boxShadow: '0 4px 10px -6px rgba(80,50,10,0.25)',
          fontFamily: SFD
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: MP.ink, letterSpacing: -0.4 }}>
            {Math.round(doneMin)}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: MP.ink2 }}>
            / {goalMin} 分
          </span>
        </div>
      </div>
    </div>);

}

// Pet avatar — side-view walking dog with CSS animations.
function PetAvatar({ complete }) {
  // Slow the gait + relax pose when goal complete.
  const dur = complete ? '0.9s' : '0.45s';
  return (
    <div style={{ position: 'relative', width: 85, height: 65 }}>
      <style>{`
        .wd-body { animation: wd-bob ${dur} ease-in-out infinite; transform-origin: 50% 50%; }
        .wd-leg  { transform-box: fill-box; transform-origin: 50% 0%; animation-duration: ${dur}; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wd-leg.a { animation-name: wd-swingA; }
        .wd-leg.b { animation-name: wd-swingB; }
        .wd-tail { transform-box: fill-box; transform-origin: 95% 90%; animation: wd-wag 0.36s ease-in-out infinite; }
        .wd-ground { animation: wd-ground ${dur} linear infinite; }
        @keyframes wd-bob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        @keyframes wd-swingA{ 0%,100%{transform:rotate(18deg)}  50%{transform:rotate(-18deg)} }
        @keyframes wd-swingB{ 0%,100%{transform:rotate(-18deg)} 50%{transform:rotate(18deg)} }
        @keyframes wd-wag   { 0%,100%{transform:rotate(-6deg)}  50%{transform:rotate(22deg)} }
        @keyframes wd-ground{ 0%{transform:translateX(0)} 100%{transform:translateX(-24px)} }
        @keyframes flame-flicker { 0%,100%{transform:scale(1) rotate(-2deg)} 50%{transform:scale(1.12) rotate(3deg)} }
        .streak-flame { animation: flame-flicker 1.1s ease-in-out infinite; transform-origin: 50% 90%; }
        @media (prefers-reduced-motion: reduce) {
          .wd-body,.wd-leg,.wd-tail,.wd-ground,.streak-flame { animation: none !important; }
        }
      `}</style>
      <svg width="85" height="65" viewBox="0 0 200 140" style={{ display: 'block' }}>
        {/* moving ground dots — sense of motion */}
        <g className="wd-ground">
          {[-10, 20, 50, 80, 110, 140, 170, 200, 230].map((x, i) =>
          <circle key={i} cx={x} cy="128" r="1.6" fill="#c9b27f" opacity="0.55" />
          )}
        </g>
        {/* contact shadow */}
        <ellipse cx="100" cy="126" rx="56" ry="4" fill="#000" opacity="0.08" />

        <g className="wd-body">
          {/* far-side back leg (darker) */}
          <rect className="wd-leg b" x="58" y="82" width="9" height="32" rx="3" fill="#b4773a" />
          {/* near-side back leg */}
          <rect className="wd-leg a" x="48" y="82" width="9" height="32" rx="3" fill="#d99258" />

          {/* tail */}
          <path className="wd-tail" d="M52 64 Q34 50 44 28 Q54 42 62 60 Z" fill="#d99258" />

          {/* body */}
          <ellipse cx="100" cy="72" rx="52" ry="22" fill="#e8a85a" />
          {/* belly highlight */}
          <ellipse cx="100" cy="84" rx="40" ry="8" fill="#fff5d8" opacity="0.7" />

          {/* head */}
          <circle cx="150" cy="56" r="22" fill="#e8a85a" />
          {/* ear (perked) */}
          <path d="M156 36 L170 28 L165 52 Z" fill="#b4773a" />
          {/* snout/muzzle */}
          <ellipse cx="170" cy="64" rx="14" ry="9" fill="#fff5d8" />
          {/* nose */}
          <ellipse cx="180" cy="61" rx="3.2" ry="2.6" fill="#231b14" />
          {/* eye */}
          {complete ?
          <path d="M150 52 Q154 49 158 52" stroke="#231b14" strokeWidth="2" fill="none" strokeLinecap="round" /> :
          <circle cx="154" cy="52" r="2.2" fill="#231b14" />
          }
          {/* mouth */}
          <path d={complete ? "M167 70 Q172 76 178 70" : "M170 70 Q173 72 178 70"} stroke="#231b14" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {/* tongue when happy */}
          {complete && <ellipse cx="173" cy="73" rx="3.5" ry="2.2" fill="#ff8e8e" />}
          {/* cheek */}
          <circle cx="142" cy="68" r="3" fill="#ffb3ba" opacity="0.55" />

          {/* far-side front leg */}
          <rect className="wd-leg b" x="138" y="86" width="9" height="32" rx="3" fill="#b4773a" />
          {/* near-side front leg */}
          <rect className="wd-leg a" x="128" y="86" width="9" height="32" rx="3" fill="#d99258" />
        </g>
      </svg>
    </div>);

}

// ── Week strip — 7 days, completed days filled with a paw ──────────
function WeekStrip({ days, todayIdx, complete }) {
  const labels = ['一', '二', '三', '四', '五', '六', '日'];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6,
      padding: '14px 12px', background: MP.card,
      border: `1px solid ${MP.hairline}`, borderRadius: 18,
      boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 20px -16px rgba(80,50,10,0.18)'
    }}>
      {labels.map((l, i) => {
        const done = days[i];
        const isToday = i === todayIdx;
        const todayDone = isToday && complete;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: SF, fontSize: 11, fontWeight: 600,
              color: isToday ? MP.brandDeep : MP.ink3,
              letterSpacing: 0.3
            }}>{l}</span>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              background: done ?
              todayDone ? MP.leaf : MP.brand :
              isToday ? MP.brandTint : 'transparent',
              border: done ?
              'none' :
              `1.5px ${isToday ? 'solid' : 'dashed'} ${isToday ? MP.brand : MP.hairline}`,
              color: done ? '#fff' : isToday ? MP.brandDeep : MP.ink3,
              boxShadow: todayDone ? '0 0 0 3px ' + MP.leafTint : 'none'
            }}>
              {done ? Icon.paw(16) :
              isToday ?
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: MP.brand }} /> :
              null
              }
            </div>
          </div>);

      })}
    </div>);

}

// ── Stat pill ──────────────────────────────────────────────────────
function StatPill({ icon, value, label, accent }) {
  return (
    <div style={{
      flex: 1, padding: '12px 12px',
      background: MP.card, border: `1px solid ${MP.hairline}`, borderRadius: 14,
      display: 'flex', flexDirection: 'column', gap: 4,
      boxShadow: '0 1px 0 rgba(0,0,0,0.02)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: accent ?? MP.ink2 }}>
        {icon}
        <span style={{ fontFamily: SFD, fontSize: 18, fontWeight: 700, color: MP.ink, letterSpacing: -0.3 }}>
          {value}
        </span>
      </div>
      <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 500, color: MP.ink3, letterSpacing: 0.2, textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>);

}

// ── Walk row in recent list ───────────────────────────────────────
function WalkRow({ when, km, min, score, manual, walker }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'center',
      padding: '12px 14px', background: MP.card,
      border: `1px solid ${MP.hairline}`, borderRadius: 14
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: manual ? MP.bgAlt : MP.brandTint,
        color: manual ? MP.ink2 : MP.brandDeep,
        display: 'grid', placeItems: 'center', flexShrink: 0
      }}>
        {manual ? Icon.hand(18) : Icon.paw(18)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: MP.ink }}>
            Mango
          </span>
          <span style={{ fontFamily: SF, fontSize: 12, color: MP.ink3 }}>{when}</span>
        </div>
        <div style={{ marginTop: 4, display: 'flex', gap: 12, fontFamily: SF, fontSize: 12.5, color: MP.ink2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: MP.ink3 }}>{Icon.route(13)}</span>{km}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: MP.ink3 }}>{Icon.clock(13)}</span>{min}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: MP.brandDeep, fontWeight: 600 }}>
            {Icon.star(12)}{score}
          </span>
        </div>
      </div>
    </div>);

}

// ── Tab bar (raised middle disc for walks) ────────────────────────
function TabBar({ active = 'walks' }) {
  const tabs = [
  { id: 'home', label: '首頁', icon: Icon.tabHome },
  { id: 'feed', label: '動態', icon: Icon.tabFeed },
  { id: 'walks', label: '遛狗' }, // raised
  { id: 'board', label: '排行', icon: Icon.tabBoard },
  { id: 'more', label: '更多', icon: Icon.tabMore }];

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      height: 88, paddingBottom: 28,
      background: MP.cardSoft + 'f0', backdropFilter: 'blur(20px)',
      borderTop: `0.5px solid ${MP.hairline}`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start',
      paddingTop: 8, zIndex: 5
    }}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        if (t.id === 'walks') {
          return (
            <div key={t.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              transform: 'translateY(-14px)'
            }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%',
                background: `linear-gradient(180deg, ${MP.brand} 0%, ${MP.brandDeep} 100%)`,
                color: MP.ink, display: 'grid', placeItems: 'center',
                boxShadow: '0 10px 22px -6px rgba(243,152,0,0.55), 0 0 0 4px ' + MP.cardSoft
              }}>
                {Icon.paw(26)}
              </div>
              <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: MP.brandDeep }}>遛狗</span>
            </div>);

        }
        return (
          <div key={t.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: isActive ? MP.brandDeep : MP.ink3,
            fontFamily: SF, fontSize: 10, fontWeight: 500, paddingTop: 4
          }}>
            {t.icon(24, isActive)}
            <span>{t.label}</span>
          </div>);

      })}
    </div>);

}

// ── Confetti decor (subtle, top of screen) ────────────────────────
function Confetti() {
  const pieces = [
  { left: 6, top: 8, rot: -18, c: MP.brand },
  { left: 18, top: 22, rot: 24, c: MP.leaf },
  { left: 30, top: 6, rot: 8, c: MP.peach },
  { left: 48, top: 18, rot: -12, c: MP.amber },
  { left: 62, top: 9, rot: 30, c: MP.brand },
  { left: 78, top: 22, rot: -22, c: MP.leaf },
  { left: 90, top: 6, rot: 12, c: MP.cookie },
  { left: 12, top: 40, rot: 18, c: MP.amber },
  { left: 84, top: 38, rot: -8, c: MP.peach }];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {pieces.map((p, i) =>
      <div key={i} style={{
        position: 'absolute',
        left: `${p.left}%`, top: `${p.top}%`,
        width: 6, height: 12, borderRadius: 2,
        background: p.c, transform: `rotate(${p.rot}deg)`,
        opacity: 0.85
      }} />
      )}
    </div>);

}

// ── The screen ────────────────────────────────────────────────────
function WalksScreen({ state = 'incomplete' }) {
  const complete = state === 'complete';
  const doneMin = complete ? 32 : 18;
  const goalMin = 30;
  const percent = doneMin / goalMin * 100;

  // Mon-Sun, today is Wednesday (idx 2). Sun(0)Mon(1)Tue(2) done already.
  // Actually map M T W T F S S; let's say Mon/Tue done, Wed today.
  const days = complete ?
  [true, true, true, false, false, false, false] :
  [true, true, false, false, false, false, false];
  const todayIdx = 2;

  const weekCount = complete ? 3 : 2;
  const weekGoal = 5;
  const streak = complete ? 4 : 3;
  const weekKm = complete ? '6.8' : '4.2';

  const heroLine = complete ?
  "達標了 🎉" :
  "再走 12 分鐘";

  const subLine = complete ?
  `Mango 今天走了 32 分 · 連續 ${streak} 天` :
  `Mango 今天走了 ${doneMin} 分 · 連續 ${streak} 天`;

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: MP.bg, overflow: 'hidden',
      fontFamily: SF, color: MP.ink
    }}>
      <div style={{
        position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden',
        paddingBottom: 230
      }}>
      {complete && <Confetti />}

      {/* Top bar — title + Mango pill + streak chip. */}
      <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px 4px', position: 'relative', zIndex: 1
        }}>
        <div style={{ fontFamily: SFD, fontSize: 22, fontWeight: 700, color: MP.ink, letterSpacing: -0.4 }}>
          遛狗
        </div>
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px 5px 5px', borderRadius: 999,
            background: MP.card, border: `1px solid ${MP.hairline}`,
            fontFamily: SF, fontSize: 13, fontWeight: 600, color: MP.ink
          }}>
          <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#f7c168', display: 'grid', placeItems: 'center',
              overflow: 'hidden', fontSize: 13
            }}>🐶</div>
          Mango
          <span style={{ color: MP.ink3 }}>{Icon.chev(10)}</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 13px 7px 11px', borderRadius: 999,
            background: streak >= 7 ?
            `linear-gradient(135deg, ${MP.leafTint} 0%, #d8f2de 100%)` :
            `linear-gradient(135deg, #ffdca0 0%, ${MP.brandTint} 100%)`,
            color: streak >= 7 ? MP.leafDeep : MP.brandDeep,
            fontFamily: SF, fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap',
            boxShadow: streak >= 7 ?
            '0 4px 12px -4px rgba(63,138,58,0.40)' :
            '0 4px 12px -4px rgba(243,152,0,0.50)'
          }}>
          <span className="streak-flame" style={{ display: 'inline-flex', filter: 'drop-shadow(0 1px 1px rgba(180,60,0,0.35))' }}>
            <svg width="16" height="18" viewBox="0 0 24 28">
              <defs>
                <linearGradient id="flame-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffd84a" />
                  <stop offset="55%" stopColor="#ff8a1a" />
                  <stop offset="100%" stopColor="#e63a1a" />
                </linearGradient>
              </defs>
              <path d="M12 2C12 6 8 8 6 12c-2 4-2 9 2 12 1.5 1 3.5 1.7 4 1.7s2.5-.7 4-1.7c4-3 4-8 2-12-1-2-3-3-3-5 0 1.5-1 2.5-2 2.5C12 9.5 12 6 12 2z"
                fill="url(#flame-grad)" />
              <path d="M12 14c-1 1.5-2 3-2 5 0 2 1 3.5 2 3.5s2-1.5 2-3.5c0-2-1-3.5-2-5z" fill="#ffec8a" opacity="0.8" />
            </svg>
          </span>
          <span style={{ whiteSpace: 'nowrap' }}>{`${streak} 天`}</span>
        </div>
      </div>

      {/* Hero line — title + sub-line. */}
      <div style={{ padding: '12px 24px 0', position: 'relative', zIndex: 1 }}>
        <h1 style={{
            fontFamily: SFD, fontSize: 26, fontWeight: 700,
            color: MP.ink, letterSpacing: -0.5, lineHeight: 1.15, margin: 0
          }}>
          {heroLine}
        </h1>
        <p style={{
            fontFamily: SF, fontSize: 13, fontWeight: 500,
            color: MP.ink2, margin: '5px 0 0'
          }}>
          {subLine}
        </p>
      </div>

      {/* Dial */}
      <div style={{ padding: '8px 0 24px', position: 'relative', zIndex: 1 }}>
        <Dial percent={percent} complete={complete} doneMin={doneMin} goalMin={goalMin} />
      </div>

      {/* Week strip */}
      <div style={{ padding: '0 16px', position: 'relative', zIndex: 1 }}>
        <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            padding: '0 4px 8px'
          }}>
          <span style={{ fontFamily: SF, fontSize: 12, fontWeight: 600, color: MP.ink2 }}>
            本週
          </span>
          <span style={{ fontFamily: SF, fontSize: 12, color: MP.ink3 }}>
            <strong style={{ color: MP.ink, fontWeight: 700 }}>{weekCount}</strong> / {weekGoal} 次 · {weekKm} 公里
          </span>
        </div>
        <WeekStrip days={days} todayIdx={todayIdx} complete={complete} />
      </div>

      {/* Recent walks */}
      <div style={{ padding: '20px 16px 0', position: 'relative', zIndex: 1 }}>
        <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            padding: '0 4px 10px'
          }}>
          <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: MP.ink }}>
            最近紀錄
          </span>
          <span style={{ fontFamily: SF, fontSize: 12, color: MP.brandDeep, fontWeight: 600 }}>
            全部
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {complete &&
            <WalkRow when="剛剛" km="2.4 公里" min="32 分" score="8.6" />
            }
          <WalkRow when="昨天" km="1.8 公里" min="24 分" score="7.2" />
          <WalkRow when="週一" km="2.1 公里" min="28 分" score="7.9" />
        </div>
      </div>

      </div>

      {/* Sticky bottom CTA — solo floating pill, no dock wrapper */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 152,
        padding: '0 20px',
        zIndex: 6, fontWeight: "700"
      }}>
        <button style={{
          width: '100%', height: 56, borderRadius: 999,
          border: 'none',
          background: complete ?
          MP.card :
          `linear-gradient(180deg, ${MP.brand} 0%, ${MP.brandDeep} 100%)`,
          color: complete ? MP.ink : MP.ink,
          boxShadow: complete ?
          `0 10px 24px -8px rgba(80,50,10,0.22), inset 0 0 0 1.5px ${MP.brand}` :
          '0 16px 32px -8px rgba(243,152,0,0.60), 0 4px 10px -4px rgba(180,100,0,0.35), 0 1px 0 rgba(255,255,255,0.3) inset',
          fontFamily: SFD, fontSize: 17, fontWeight: 700, letterSpacing: -0.2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
        }}>
          {complete ?
          <>
              <span style={{ color: MP.brandDeep }}>{Icon.plus(20)}</span>
              再遛一次
            </> :

          <>
              {Icon.play(20)}
              開始遛狗
            </>
          }
        </button>
      </div>

      <TabBar active="walks" />
    </div>);

}

window.WalksScreen = WalksScreen;
window.MP = MP;