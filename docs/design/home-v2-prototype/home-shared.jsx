// Home screen — Phase 3 redesign. Shared tokens + icons + bottom nav.
// Palette + typography lifted 1:1 from walks-screen.jsx / pets-screen.jsx so
// the three pages share a single visual family (Phase 0/0.5/1/2 already shipped).

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
  peachTint: '#ffe4e6',
};

const SF  = '-apple-system, "SF Pro Text", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif';
const SFD = '-apple-system, "SF Pro Display", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif';

const Icon = {
  paw: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <ellipse cx="6.5" cy="9" rx="1.8" ry="2.3"/>
      <ellipse cx="17.5" cy="9" rx="1.8" ry="2.3"/>
      <ellipse cx="9.5" cy="5.5" rx="1.6" ry="2.1"/>
      <ellipse cx="14.5" cy="5.5" rx="1.6" ry="2.1"/>
      <path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z"/>
    </svg>,
  bell: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z"/>
      <path d="M10 19a2 2 0 0 0 4 0"/>
    </svg>,
  cookie: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 9 9 5 5 0 0 1-5-5 4 4 0 0 1-4-4z"/>
      <circle cx="9" cy="11" r="0.9" fill="currentColor"/>
      <circle cx="14" cy="14.5" r="0.9" fill="currentColor"/>
      <circle cx="8.5" cy="15.5" r="0.7" fill="currentColor"/>
    </svg>,
  heart: (s = 18, filled) =>
    filled
      ? <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.4-9.3-9C1.2 8.4 3.4 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.6 0 5.8 3.9 4.3 7.5C19 16.6 12 21 12 21z"/></svg>
      : <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-4.4-9.3-9C1.2 8.4 3.4 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.6 0 5.8 3.9 4.3 7.5C19 16.6 12 21 12 21z"/></svg>,
  chat: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.4 7.2L4 21l1.8-5.6A8 8 0 1 1 21 12z"/>
    </svg>,
  plus: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>,
  chev: (s = 14) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6"/>
    </svg>,
  camera: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h3l2-3h8l2 3h3v11H3z"/>
      <circle cx="12" cy="13" r="3.5"/>
    </svg>,
  receipt: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/>
      <path d="M9 8h6M9 12h6M9 16h4"/>
    </svg>,
  pen: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 5.5l4 4L8 20l-4.5.5L4 16 14.5 5.5z"/>
      <path d="M13 7l4 4"/>
    </svg>,
  flame: (s = 14) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2s-1 3-3 5-3 4-3 7a6 6 0 1 0 12 0c0-2-1-3-2-4 0 2-1 3-2 3 0-3-2-6-2-11z"/>
    </svg>,
  globe: (s = 12) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>
    </svg>,
  users: (s = 12) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3"/>
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5"/>
      <circle cx="17" cy="9" r="2.5"/>
      <path d="M15 14c4 0 6 2 6 5"/>
    </svg>,
  home: (s = 12) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2v-9z"/>
    </svg>,
  // Bottom-nav icons — 1:1 with walks/pets so the bars match
  tabHome: (s = 24, filled) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7">
      <path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2v-9z" strokeLinejoin="round"/>
    </svg>,
  tabPets: (s = 24, filled) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <ellipse cx="6.5" cy="9" rx="1.8" ry="2.3" fill={filled ? 'currentColor' : 'none'}/>
      <ellipse cx="17.5" cy="9" rx="1.8" ry="2.3" fill={filled ? 'currentColor' : 'none'}/>
      <ellipse cx="9.5" cy="5.5" rx="1.6" ry="2.1" fill={filled ? 'currentColor' : 'none'}/>
      <ellipse cx="14.5" cy="5.5" rx="1.6" ry="2.1" fill={filled ? 'currentColor' : 'none'}/>
      <path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z"/>
    </svg>,
  tabBoard: (s = 24, filled) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V12M12 19V5M20 19v-9"/>
    </svg>,
  tabMore: (s = 24) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>
    </svg>,
  pawTab: (s = 26) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <ellipse cx="6.5" cy="9" rx="1.8" ry="2.3"/>
      <ellipse cx="17.5" cy="9" rx="1.8" ry="2.3"/>
      <ellipse cx="9.5" cy="5.5" rx="1.6" ry="2.1"/>
      <ellipse cx="14.5" cy="5.5" rx="1.6" ry="2.1"/>
      <path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z"/>
    </svg>,
};

// ── Tiny pet avatar (re-used by carousels + feed). Two coats: shiba + frenchie.
function PetMini({ pet, size = 48 }) {
  const s = size;
  if (pet.kind === 'shiba') {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" style={{ display: 'block', borderRadius: '50%', background: '#ffd791' }}>
        <path d="M14 18 L20 8 L25 22 Z" fill="#b4773a"/>
        <path d="M50 18 L44 8 L39 22 Z" fill="#b4773a"/>
        <path d="M16 19 L21 12 L24 22 Z" fill="#e8a85a"/>
        <path d="M48 19 L43 12 L40 22 Z" fill="#e8a85a"/>
        <ellipse cx="32" cy="34" rx="22" ry="20" fill="#e8a85a"/>
        <ellipse cx="32" cy="44" rx="14" ry="10" fill="#fff5d8"/>
        <circle cx="24" cy="32" r="2" fill="#231b14"/>
        <circle cx="40" cy="32" r="2" fill="#231b14"/>
        <ellipse cx="32" cy="40" rx="2.6" ry="2" fill="#231b14"/>
        <path d="M30 44 Q32 47 34 44" stroke="#231b14" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      </svg>
    );
  }
  if (pet.kind === 'frenchie') {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" style={{ display: 'block', borderRadius: '50%', background: '#fde0c8' }}>
        <path d="M10 22 Q9 8 19 10 L22 24 Z" fill="#d99e7a"/>
        <path d="M54 22 Q55 8 45 10 L42 24 Z" fill="#d99e7a"/>
        <ellipse cx="32" cy="36" rx="22" ry="19" fill="#f3c8a3"/>
        <ellipse cx="40" cy="30" rx="7" ry="6" fill="#7a5a3a" opacity="0.55"/>
        <ellipse cx="32" cy="45" rx="11" ry="7.5" fill="#fff2e0"/>
        <circle cx="24" cy="32" r="2.1" fill="#231b14"/>
        <circle cx="40" cy="32" r="2.1" fill="#231b14"/>
        <ellipse cx="32" cy="41" rx="3.2" ry="2.3" fill="#231b14"/>
        <path d="M27 46 Q32 50 37 46" stroke="#231b14" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      </svg>
    );
  }
  // tabby cat
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" style={{ display: 'block', borderRadius: '50%', background: '#e7d4a8' }}>
      <path d="M12 22 L18 8 L24 22 Z" fill="#8b6a3a"/>
      <path d="M52 22 L46 8 L40 22 Z" fill="#8b6a3a"/>
      <path d="M15 22 L19 13 L23 22 Z" fill="#d9a85e"/>
      <path d="M49 22 L45 13 L41 22 Z" fill="#d9a85e"/>
      <ellipse cx="32" cy="36" rx="22" ry="19" fill="#d9a85e"/>
      <path d="M14 36 Q22 32 30 36 M50 36 Q42 32 34 36" stroke="#8b6a3a" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.7"/>
      <circle cx="24" cy="33" r="2.2" fill="#231b14"/>
      <circle cx="40" cy="33" r="2.2" fill="#231b14"/>
      <path d="M32 40 L30 42 L32 44 L34 42 Z" fill="#ff9aa2"/>
      <path d="M30 44 Q32 47 34 44" stroke="#231b14" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

// ── Person avatar — initial inside a tinted circle (graceful when no photo) ──
function PersonAvatar({ name, color = MP.brandTint, ink = MP.brandDeep, size = 36 }) {
  const initial = (name || '?').slice(0, 1);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: ink,
      display: 'grid', placeItems: 'center', flexShrink: 0,
      fontFamily: SFD, fontSize: Math.round(size * 0.42), fontWeight: 800,
      letterSpacing: -0.3,
    }}>{initial}</div>
  );
}

// ── Bottom nav — 5 tabs, raised walks disc. Tab[0] active on home. ──
function BottomNav({ active = 'home' }) {
  const tabs = [
    { id: 'home',  label: '首頁',     icon: Icon.tabHome  },
    { id: 'pets',  label: '我的寵物', icon: Icon.tabPets  },
    { id: 'walks', label: '遛狗' }, // raised
    { id: 'board', label: '排行',     icon: Icon.tabBoard },
    { id: 'more',  label: '更多',     icon: Icon.tabMore  },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      height: 88, paddingBottom: 28,
      background: MP.cardSoft + 'f0', backdropFilter: 'blur(20px)',
      borderTop: `0.5px solid ${MP.hairline}`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start',
      paddingTop: 8, zIndex: 5,
    }}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        if (t.id === 'walks') {
          return (
            <div key={t.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              transform: 'translateY(-14px)',
            }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%',
                background: `linear-gradient(180deg, ${MP.brand} 0%, ${MP.brandDeep} 100%)`,
                color: MP.ink, display: 'grid', placeItems: 'center',
                boxShadow: '0 10px 22px -6px rgba(243,152,0,0.55), 0 0 0 4px ' + MP.cardSoft,
              }}>{Icon.pawTab(26)}</div>
              <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: MP.brandDeep }}>遛狗</span>
            </div>
          );
        }
        return (
          <div key={t.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: isActive ? MP.brandDeep : MP.ink3,
            fontFamily: SF, fontSize: 10, fontWeight: isActive ? 700 : 500, paddingTop: 4,
          }}>
            {t.icon(24, isActive)}
            <span>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Reduced-motion catch-all (same pattern as pets-screen.jsx).
if (typeof document !== 'undefined' && !document.getElementById('home-reduced-motion')) {
  const s = document.createElement('style');
  s.id = 'home-reduced-motion';
  s.textContent = '@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }';
  document.head.appendChild(s);
}

Object.assign(window, { MP, SF, SFD, Icon, PetMini, PersonAvatar, BottomNav });
