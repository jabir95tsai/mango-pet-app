// Pets screen — Phase 2 redesign. Variant B「分頁聚焦」(Tabbed).
// Palette + typography lifted 1:1 from walks-screen.jsx so the two pages
// share a single visual family (Phase 0/0.5/1 already shipped).

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

// ── Icons (1.5–1.8 stroke; inherit color via currentColor) ─────────
const Icon = {
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
  scale: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5.5" width="17" height="14" rx="3"/>
      <path d="M8 11l4-3 4 3"/>
      <path d="M12 8v6"/>
    </svg>,
  paw: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <ellipse cx="6.5" cy="9" rx="1.8" ry="2.3"/>
      <ellipse cx="17.5" cy="9" rx="1.8" ry="2.3"/>
      <ellipse cx="9.5" cy="5.5" rx="1.6" ry="2.1"/>
      <ellipse cx="14.5" cy="5.5" rx="1.6" ry="2.1"/>
      <path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z"/>
    </svg>,
  pencil: (s = 16) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 5.5l4 4L8 20l-4.5.5L4 16 14.5 5.5z"/>
      <path d="M13 7l4 4"/>
    </svg>,
  plus: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>,
  check: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7"/>
    </svg>,
  chevDown: (s = 14) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6"/>
    </svg>,
  chev: (s = 14) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6"/>
    </svg>,
  sparkle: (s = 11) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.2 6.3L20 10l-5.8 1.7L12 18l-2.2-6.3L4 10l5.8-1.7L12 2z"/>
    </svg>,
  repeat: (s = 12) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h12l-3-3M20 16H8l3 3"/>
    </svg>,
  clock: (s = 12) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 2"/>
    </svg>,
  syringe: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 2l6 6"/>
      <path d="M14.5 3.5l6 6"/>
      <path d="M19 7l-9 9-4 1 1-4 9-9"/>
      <path d="M9 14l1 1"/>
      <path d="M11 12l1 1"/>
    </svg>,
  drop: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11z"/>
    </svg>,
  heart: (s = 18) =>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21s-7-4.4-9.3-9C1.2 8.4 3.4 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.6 0 5.8 3.9 4.3 7.5C19 16.6 12 21 12 21z"/>
    </svg>,
  // Bottom-nav icons (kept 1:1 with walks-screen so the bars match)
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

// ── Pet avatar — flat illustrated head, two species/coats ──────────
function PetAvatar({ pet, size = 64 }) {
  const s = size;
  // Shiba: warm orange head with white muzzle + perked ears
  if (pet.kind === 'shiba') {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" style={{ display: 'block', borderRadius: 22, background: '#ffd791' }}>
        {/* ears */}
        <path d="M14 18 L20 8 L25 22 Z" fill="#b4773a"/>
        <path d="M50 18 L44 8 L39 22 Z" fill="#b4773a"/>
        <path d="M16 19 L21 12 L24 22 Z" fill="#e8a85a"/>
        <path d="M48 19 L43 12 L40 22 Z" fill="#e8a85a"/>
        {/* head */}
        <ellipse cx="32" cy="34" rx="22" ry="20" fill="#e8a85a"/>
        {/* white muzzle / cheeks */}
        <ellipse cx="32" cy="44" rx="14" ry="10" fill="#fff5d8"/>
        <ellipse cx="20" cy="36" rx="5" ry="4" fill="#fff5d8" opacity="0.9"/>
        <ellipse cx="44" cy="36" rx="5" ry="4" fill="#fff5d8" opacity="0.9"/>
        {/* eyes */}
        <circle cx="24" cy="32" r="2" fill="#231b14"/>
        <circle cx="40" cy="32" r="2" fill="#231b14"/>
        {/* nose */}
        <ellipse cx="32" cy="40" rx="2.6" ry="2" fill="#231b14"/>
        {/* mouth */}
        <path d="M30 44 Q32 47 34 44" stroke="#231b14" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
        {/* cheek blush */}
        <circle cx="18" cy="42" r="2.5" fill="#ffb3ba" opacity="0.6"/>
        <circle cx="46" cy="42" r="2.5" fill="#ffb3ba" opacity="0.6"/>
      </svg>
    );
  }
  // French bulldog: cream with flat face + bat ears
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" style={{ display: 'block', borderRadius: 22, background: '#fde0c8' }}>
      {/* bat ears */}
      <path d="M10 22 Q9 8 19 10 L22 24 Z" fill="#d99e7a"/>
      <path d="M54 22 Q55 8 45 10 L42 24 Z" fill="#d99e7a"/>
      <path d="M13 22 Q13 12 18 13 L21 23 Z" fill="#f3c8a3"/>
      <path d="M51 22 Q51 12 46 13 L43 23 Z" fill="#f3c8a3"/>
      {/* head */}
      <ellipse cx="32" cy="36" rx="22" ry="19" fill="#f3c8a3"/>
      {/* eye patch (one side, classic frenchie) */}
      <ellipse cx="40" cy="30" rx="7" ry="6" fill="#7a5a3a" opacity="0.55"/>
      {/* muzzle */}
      <ellipse cx="32" cy="45" rx="11" ry="7.5" fill="#fff2e0"/>
      {/* eyes */}
      <circle cx="24" cy="32" r="2.1" fill="#231b14"/>
      <circle cx="40" cy="32" r="2.1" fill="#231b14"/>
      {/* nose (smooshed) */}
      <ellipse cx="32" cy="41" rx="3.2" ry="2.3" fill="#231b14"/>
      {/* mouth — wider grin */}
      <path d="M27 46 Q32 50 37 46" stroke="#231b14" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      {/* tongue tip */}
      <ellipse cx="32" cy="48" rx="1.8" ry="1.2" fill="#ff8e8e"/>
    </svg>
  );
}

// ── Top bar: 我的寵物 + 「+ 寵物」pill ────────────────────────────
function TopBar({ title = '我的寵物', onAdd }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px 6px'
    }}>
      <h1 style={{
        fontFamily: SFD, fontSize: 26, fontWeight: 800,
        color: MP.ink, letterSpacing: -0.5, margin: 0
      }}>
        {title}
      </h1>
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        height: 34, padding: '0 12px 0 8px', borderRadius: 999,
        background: MP.brandTint, color: MP.brandDeep,
        border: 'none', fontFamily: SF, fontSize: 14, fontWeight: 700,
        letterSpacing: -0.1
      }}>
        {Icon.plus(16)}寵物
      </button>
    </div>
  );
}

// ── Pet header: avatar + name + chips + pencil + (chevron) ─────────
function PetHeader({ pet, multi, dropdownOpen }) {
  return (
    <div style={{ padding: '8px 20px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <PetAvatar pet={pet} size={64}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontFamily: SFD, fontSize: 22, fontWeight: 800,
              color: MP.ink, letterSpacing: -0.4
            }}>{pet.name}</span>
            {multi && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: 8,
                color: MP.ink2,
                transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 180ms ease'
              }}>{Icon.chevDown(14)}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
            {[pet.breed, `${pet.sex} · ${pet.age}`, `${pet.weight} 公斤`].map((t, i) =>
              <span key={i} style={{
                fontFamily: SF, fontSize: 11.5, fontWeight: 600,
                color: MP.ink2, background: MP.bgAlt,
                padding: '4px 9px', borderRadius: 999,
                border: `0.5px solid ${MP.hairline}`, letterSpacing: 0.1
              }}>{t}</span>
            )}
          </div>
        </div>
        <button style={{
          width: 36, height: 36, borderRadius: 12, flexShrink: 0,
          background: MP.card, border: `1px solid ${MP.hairline}`,
          color: MP.ink2, display: 'grid', placeItems: 'center'
        }}>{Icon.pencil(16)}</button>
      </div>
    </div>
  );
}

// ── Switcher dropdown — small floating panel under pet name ────────
function PetSwitcher({ pets, currentId }) {
  return (
    <div style={{
      position: 'absolute', top: 152, left: 20, width: 240,
      background: MP.card, borderRadius: 18,
      border: `1px solid ${MP.hairline}`,
      boxShadow: '0 18px 38px -14px rgba(80,50,10,0.28), 0 4px 10px -4px rgba(80,50,10,0.14)',
      padding: 6, zIndex: 8
    }}>
      {pets.map((p, i) => {
        const active = p.id === currentId;
        return (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 8px', borderRadius: 12,
            background: active ? MP.brandTint : 'transparent'
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 12, overflow: 'hidden' }}>
              <PetAvatar pet={p} size={34}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: SF, fontSize: 14, fontWeight: 700,
                color: MP.ink, lineHeight: 1.1
              }}>{p.name}</div>
              <div style={{
                fontFamily: SF, fontSize: 11, color: MP.ink3, marginTop: 2
              }}>{p.breed} · {p.weight} kg</div>
            </div>
            {active && (
              <span style={{ color: MP.brandDeep }}>{Icon.check(16)}</span>
            )}
          </div>
        );
      })}
      <div style={{ height: 1, background: MP.hairline, margin: '6px 6px' }}/>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 8px', borderRadius: 12,
        color: MP.brandDeep
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 12,
          background: MP.brandTint, color: MP.brandDeep,
          display: 'grid', placeItems: 'center'
        }}>{Icon.plus(18)}</div>
        <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 700 }}>新增寵物</span>
      </div>
    </div>
  );
}

// ── Sticky pill tab bar (4 tabs) ───────────────────────────────────
const PET_TABS = [
  { id: 'overview', label: '概覽' },
  { id: 'reminders', label: '提醒' },
  { id: 'expenses', label: '開銷' },
  { id: 'health', label: '健康' }
];

function PetTabs({ active }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 4,
      padding: '14px 16px 10px',
      background: `linear-gradient(180deg, ${MP.bg} 0%, ${MP.bg} 70%, rgba(251,241,221,0) 100%)`
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
        background: MP.bgAlt, borderRadius: 999, padding: 4,
        border: `1px solid ${MP.hairline}`
      }}>
        {PET_TABS.map(t => {
          const isActive = t.id === active;
          return (
            <div key={t.id} style={{
              padding: '8px 0', textAlign: 'center', borderRadius: 999,
              background: isActive ? MP.card : 'transparent',
              color: isActive ? MP.ink : MP.ink2,
              fontFamily: SF, fontSize: 13.5,
              fontWeight: isActive ? 700 : 600, letterSpacing: 0.2,
              boxShadow: isActive ? '0 4px 10px -6px rgba(80,50,10,0.30), 0 1px 0 rgba(0,0,0,0.02)' : 'none',
              transition: 'background 200ms ease, color 200ms ease'
            }}>{t.label}</div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stat tile + grid ───────────────────────────────────────────────
function StatTile({ icon, iconBg, iconColor, label, value, unit, sub, subTone }) {
  return (
    <div style={{
      background: MP.card, border: `1px solid ${MP.hairline}`,
      borderRadius: 18, padding: '14px 14px',
      boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 20px -18px rgba(80,50,10,0.18)',
      display: 'flex', flexDirection: 'column', gap: 8, minHeight: 116
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 10,
          background: iconBg, color: iconColor,
          display: 'grid', placeItems: 'center'
        }}>{icon}</div>
        <span style={{
          fontFamily: SF, fontSize: 11.5, fontWeight: 600,
          color: MP.ink3, letterSpacing: 0.3, textTransform: 'uppercase'
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontFamily: SFD, fontSize: 26, fontWeight: 800,
          color: MP.ink, letterSpacing: -0.7, lineHeight: 1
        }}>{value}</span>
        {unit && <span style={{
          fontFamily: SF, fontSize: 12, fontWeight: 600, color: MP.ink2
        }}>{unit}</span>}
      </div>
      <span style={{
        fontFamily: SF, fontSize: 12, fontWeight: 500,
        color: subTone || MP.ink3, marginTop: -2
      }}>{sub}</span>
    </div>
  );
}

function StatGrid({ pet }) {
  return (
    <div style={{
      padding: '4px 16px 0',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10
    }}>
      <StatTile
        icon={Icon.bell(16)} iconBg={MP.brandTint} iconColor={MP.brandDeep}
        label="下次提醒" value="2" unit="天後"
        sub="心絲蟲預防 · 週六 09:00" subTone={MP.brandDeep}/>
      <StatTile
        icon={Icon.cookie(16)} iconBg={MP.cookieTint} iconColor={MP.cookie}
        label="本月開銷" value={pet.monthSpend} unit="NT$"
        sub="較上月 +12%" subTone={MP.ink2}/>
      <StatTile
        icon={Icon.scale(16)} iconBg={MP.leafTint} iconColor={MP.leafDeep}
        label="體重" value={pet.weight} unit="公斤"
        sub="上次 +0.3 · 11/18" subTone={MP.leafDeep}/>
      <StatTile
        icon={Icon.paw(16)} iconBg={MP.brandTint} iconColor={MP.brandDeep}
        label="散步天數" value="18" unit="天 · 本月"
        sub={`連續 ${pet.streak} 天 🔥`} subTone={MP.ink2}/>
    </div>
  );
}

// ── Section header (inline strips) ─────────────────────────────────
function SectionHeader({ title, action = '全部' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '20px 20px 8px'
    }}>
      <span style={{
        fontFamily: SF, fontSize: 14, fontWeight: 700, color: MP.ink, letterSpacing: -0.1
      }}>{title}</span>
      <span style={{
        fontFamily: SF, fontSize: 12.5, fontWeight: 600, color: MP.brandDeep
      }}>{action}</span>
    </div>
  );
}

// ── Reminder card ──────────────────────────────────────────────────
function ReminderCard({ icon, iconBg, iconColor, title, repeat, due, dueTone, checked }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 14px', background: MP.card,
      border: `1px solid ${MP.hairline}`, borderRadius: 18,
      boxShadow: '0 1px 0 rgba(0,0,0,0.02)'
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 14, flexShrink: 0,
        background: iconBg, color: iconColor,
        display: 'grid', placeItems: 'center'
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: SF, fontSize: 14.5, fontWeight: 700, color: MP.ink, letterSpacing: -0.1
        }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontFamily: SF, fontSize: 11, fontWeight: 600, color: MP.ink2,
            background: MP.bgAlt, padding: '2px 7px', borderRadius: 999
          }}>{Icon.repeat(11)}{repeat}</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontFamily: SF, fontSize: 11.5, fontWeight: 600, color: dueTone || MP.ink2
          }}>{Icon.clock(11)}{due}</span>
        </div>
      </div>
      <button style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: checked ? MP.leaf : MP.card,
        border: checked ? 'none' : `1.5px solid ${MP.hairline}`,
        color: checked ? '#fff' : MP.ink3,
        display: 'grid', placeItems: 'center'
      }}>{Icon.check(18)}</button>
    </div>
  );
}

// ── Expense card ───────────────────────────────────────────────────
function ExpenseCard({ icon, iconBg, iconColor, title, ai, date, payer, amount }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 14px', background: MP.card,
      border: `1px solid ${MP.hairline}`, borderRadius: 18,
      boxShadow: '0 1px 0 rgba(0,0,0,0.02)'
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 14, flexShrink: 0,
        background: iconBg, color: iconColor,
        display: 'grid', placeItems: 'center'
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: SF, fontSize: 14.5, fontWeight: 700, color: MP.ink,
            letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>{title}</span>
          {ai && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontFamily: SF, fontSize: 10, fontWeight: 700, color: MP.brandDeep,
              background: MP.brandTint, padding: '2px 6px', borderRadius: 999,
              letterSpacing: 0.3
            }}>{Icon.sparkle(9)}AI</span>
          )}
        </div>
        <div style={{
          marginTop: 4, fontFamily: SF, fontSize: 11.5, color: MP.ink3
        }}>{date} · {payer} 付</div>
      </div>
      <div style={{
        fontFamily: SFD, fontSize: 16, fontWeight: 800, color: MP.ink,
        letterSpacing: -0.3, whiteSpace: 'nowrap'
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: MP.ink3, marginRight: 2 }}>NT$</span>
        {amount}
      </div>
    </div>
  );
}

// ── Health record row ──────────────────────────────────────────────
function HealthRecord({ icon, iconBg, iconColor, type, title, detail, date, note }) {
  return (
    <div style={{
      padding: '14px', background: MP.card,
      border: `1px solid ${MP.hairline}`, borderRadius: 18,
      boxShadow: '0 1px 0 rgba(0,0,0,0.02)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 14, flexShrink: 0,
          background: iconBg, color: iconColor,
          display: 'grid', placeItems: 'center'
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: SF, fontSize: 11, fontWeight: 700,
            color: iconColor, letterSpacing: 0.6, textTransform: 'uppercase'
          }}>{type}</div>
          <div style={{
            fontFamily: SF, fontSize: 14.5, fontWeight: 700, color: MP.ink,
            marginTop: 2, letterSpacing: -0.1
          }}>{title}</div>
        </div>
        <div style={{
          fontFamily: SF, fontSize: 11.5, color: MP.ink3, whiteSpace: 'nowrap'
        }}>{date}</div>
      </div>
      {(detail || note) && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px dashed ${MP.hairline}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12
        }}>
          {detail && (
            <span style={{ fontFamily: SFD, fontSize: 17, fontWeight: 800, color: MP.ink, letterSpacing: -0.3 }}>
              {detail}
            </span>
          )}
          {note && (
            <span style={{ fontFamily: SF, fontSize: 12, color: MP.ink2 }}>{note}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Floating + button ─────────────────────────────────────────────
function FloatingAdd({ tab }) {
  // Slight tone tweak per active tab so it reads "add reminder / add expense"
  const tones = {
    overview: { from: MP.brand, to: MP.brandDeep, shadow: 'rgba(243,152,0,0.55)' },
    reminders: { from: MP.brand, to: MP.brandDeep, shadow: 'rgba(243,152,0,0.55)' },
    expenses: { from: '#ee9a5a', to: MP.cookie, shadow: 'rgba(215,123,63,0.55)' },
    health: { from: '#79c074', to: MP.leafDeep, shadow: 'rgba(63,138,58,0.50)' }
  };
  const t = tones[tab] || tones.overview;
  return (
    <button style={{
      position: 'absolute', right: 20, bottom: 168,
      width: 56, height: 56, borderRadius: '50%',
      border: 'none', background: `linear-gradient(180deg, ${t.from} 0%, ${t.to} 100%)`,
      color: MP.ink,
      boxShadow: `0 16px 32px -8px ${t.shadow}, 0 4px 10px -4px rgba(80,50,10,0.30), inset 0 1px 0 rgba(255,255,255,0.4)`,
      display: 'grid', placeItems: 'center', zIndex: 6
    }}>{Icon.plus(22)}</button>
  );
}

// ── Empty state (variant F) ───────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      padding: '60px 28px 0', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14
    }}>
      <div style={{
        width: 140, height: 140, borderRadius: 999,
        background: `radial-gradient(circle at 50% 35%, ${MP.brandTint} 0%, ${MP.bgAlt} 70%)`,
        display: 'grid', placeItems: 'center', position: 'relative'
      }}>
        <div style={{ transform: 'rotate(-6deg)' }}>
          <PetAvatar pet={{ kind: 'shiba' }} size={96}/>
        </div>
        <div style={{
          position: 'absolute', right: -2, top: 6,
          width: 38, height: 38, borderRadius: '50%',
          background: MP.card, border: `1px solid ${MP.hairline}`,
          color: MP.brandDeep, display: 'grid', placeItems: 'center',
          boxShadow: '0 6px 14px -6px rgba(80,50,10,0.30)'
        }}>{Icon.plus(20)}</div>
      </div>
      <div style={{
        fontFamily: SFD, fontSize: 22, fontWeight: 800,
        color: MP.ink, letterSpacing: -0.4, marginTop: 4
      }}>還沒有寵物</div>
      <p style={{
        margin: 0, maxWidth: 280,
        fontFamily: SF, fontSize: 13.5, fontWeight: 500, color: MP.ink2, lineHeight: 1.5
      }}>新增第一隻寵物，開始追蹤散步、開銷與健康紀錄。</p>
      <button style={{
        marginTop: 16, height: 50, padding: '0 22px', borderRadius: 999,
        background: `linear-gradient(180deg, ${MP.brand} 0%, ${MP.brandDeep} 100%)`,
        color: MP.ink, border: 'none',
        fontFamily: SFD, fontSize: 16, fontWeight: 800, letterSpacing: -0.2,
        boxShadow: '0 16px 28px -10px rgba(243,152,0,0.55), 0 3px 8px -3px rgba(180,100,0,0.30)',
        display: 'inline-flex', alignItems: 'center', gap: 8
      }}>{Icon.plus(18)}新增寵物</button>
      <div style={{
        marginTop: 24, fontFamily: SF, fontSize: 12, color: MP.ink3
      }}>之後可以隨時新增、編輯或切換</div>
    </div>
  );
}

// ── Bottom nav (5 tabs, raised walks disc, pets active in tab[1]) ──
function BottomNav({ active = 'pets' }) {
  const tabs = [
    { id: 'home', label: '首頁', icon: Icon.tabHome },
    { id: 'pets', label: '我的寵物', icon: Icon.tabPets },
    { id: 'walks', label: '遛狗' }, // raised
    { id: 'board', label: '排行', icon: Icon.tabBoard },
    { id: 'more', label: '更多', icon: Icon.tabMore }
  ];
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
              }}>{Icon.pawTab(26)}</div>
              <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: MP.brandDeep }}>遛狗</span>
            </div>
          );
        }
        return (
          <div key={t.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: isActive ? MP.brandDeep : MP.ink3,
            fontFamily: SF, fontSize: 10, fontWeight: isActive ? 700 : 500, paddingTop: 4
          }}>
            {t.icon(24, isActive)}
            <span>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Demo data ─────────────────────────────────────────────────────
const PETS = [
  { id: 'mango',  name: 'Mango', kind: 'shiba',    breed: '柴犬',     sex: '公',  age: '3 歲', weight: 12.5, monthSpend: '3,840', streak: 4 },
  { id: 'coco',   name: 'Coco',  kind: 'frenchie', breed: '法國鬥牛犬', sex: '母', age: '5 歲', weight: 9.8,  monthSpend: '2,260', streak: 0 },
];

const REMINDERS = [
  { id: 'r1', icon: Icon.drop(18),    iconBg: MP.brandTint, iconColor: MP.brandDeep, title: '心絲蟲預防藥',  repeat: '每月', due: '2 天後 · 09:00', dueTone: MP.brandDeep, checked: false },
  { id: 'r2', icon: Icon.drop(18),    iconBg: MP.peachTint, iconColor: MP.cookie,    title: '洗澡',         repeat: '每 2 週', due: '4 天後',         dueTone: MP.ink2,      checked: false },
  { id: 'r3', icon: Icon.syringe(18), iconBg: MP.leafTint,  iconColor: MP.leafDeep,  title: '年度疫苗回診',  repeat: '每年',   due: '22 天後',         dueTone: MP.ink2,      checked: false },
  { id: 'r4', icon: Icon.paw(18),     iconBg: MP.bgAlt,     iconColor: MP.ink2,      title: '剪指甲',       repeat: '每月',   due: '本週日',          dueTone: MP.ink2,      checked: true  }
];

const EXPENSES = [
  { id: 'e1', icon: Icon.cookie(18), iconBg: MP.cookieTint, iconColor: MP.cookie,    title: 'Royal Canin 飼料 4kg', ai: true,  date: '2 天前', payer: '媽媽', amount: '1,580' },
  { id: 'e2', icon: Icon.cookie(18), iconBg: MP.brandTint,  iconColor: MP.brandDeep, title: '訓練用零食',           ai: true,  date: '5 天前', payer: '爸爸', amount: '320' },
  { id: 'e3', icon: Icon.drop(18),   iconBg: MP.peachTint,  iconColor: MP.cookie,    title: '美容洗澡',             ai: false, date: '上週四', payer: '媽媽', amount: '850' },
  { id: 'e4', icon: Icon.heart(18),  iconBg: MP.leafTint,   iconColor: MP.leafDeep,  title: '動物醫院 · 回診',       ai: false, date: '11/12', payer: '爸爸', amount: '1,090' },
];

const HEALTH = [
  { id: 'h1', icon: Icon.scale(18),   iconBg: MP.leafTint,   iconColor: MP.leafDeep,  type: '體重',  title: '定期量測', detail: '12.5 公斤', note: '較上次 +0.3', date: '2024/11/18' },
  { id: 'h2', icon: Icon.syringe(18), iconBg: MP.brandTint,  iconColor: MP.brandDeep, type: '疫苗',  title: '八合一疫苗', detail: '安康動物醫院', note: '下次 2025/09', date: '2024/09/04' },
  { id: 'h3', icon: Icon.drop(18),    iconBg: MP.cookieTint, iconColor: MP.cookie,    type: '驅蟲',  title: '體內外驅蟲', detail: 'NexGard Spectra', note: '每月一次',    date: '2024/10/02' },
];

// ── Tab body renderers ────────────────────────────────────────────
function OverviewBody({ pet }) {
  return (
    <>
      <StatGrid pet={pet}/>
      <SectionHeader title="即將到期"/>
      <div style={{ padding: '0 16px' }}>
        <ReminderCard {...REMINDERS[0]}/>
      </div>
      <SectionHeader title="最近開銷"/>
      <div style={{ padding: '0 16px' }}>
        <ExpenseCard {...EXPENSES[0]}/>
      </div>
    </>
  );
}

function RemindersBody() {
  return (
    <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '0 4px 4px'
      }}>
        <span style={{ fontFamily: SF, fontSize: 12, fontWeight: 600, color: MP.ink2 }}>
          本月 <strong style={{ color: MP.ink, fontWeight: 800 }}>4</strong> 條 · 已完成 1
        </span>
        <span style={{ fontFamily: SF, fontSize: 12, color: MP.ink3 }}>按到期時間排序</span>
      </div>
      {REMINDERS.map(r => <ReminderCard key={r.id} {...r}/>)}
    </div>
  );
}

// ── Donut chart for expenses by category ──────────────────────────
function ExpenseDonut({ slices, total, size = 132 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const ir = r - 18;
  // Build arc paths. Tiny gap between slices via a 1° inset on each side.
  const TAU = Math.PI * 2;
  const gap = (1.2 * Math.PI) / 180;
  let acc = -Math.PI / 2; // start at 12 o'clock
  const arcs = slices.map((s) => {
    const sweep = (s.value / total) * TAU;
    const a0 = acc + gap / 2;
    const a1 = acc + sweep - gap / 2;
    acc += sweep;
    const x0 = cx + r * Math.cos(a0),  y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1),  y1 = cy + r * Math.sin(a1);
    const ix0 = cx + ir * Math.cos(a0), iy0 = cy + ir * Math.sin(a0);
    const ix1 = cx + ir * Math.cos(a1), iy1 = cy + ir * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = [
      `M ${x0.toFixed(2)} ${y0.toFixed(2)}`,
      `A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
      `A ${ir} ${ir} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
      'Z'
    ].join(' ');
    return { ...s, d };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill={a.color}/>
      ))}
      {/* center text */}
      <text x={cx} y={cy - 4} textAnchor="middle"
        style={{ fontFamily: SF, fontSize: 9.5, fontWeight: 700, fill: MP.ink3, letterSpacing: 0.5 }}>
        本月合計
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle"
        style={{ fontFamily: SFD, fontSize: 17, fontWeight: 800, fill: MP.ink, letterSpacing: -0.4 }}>
        <tspan style={{ fontSize: 9.5, fontWeight: 600, fill: MP.ink3 }}>NT$ </tspan>
        {total.toLocaleString()}
      </text>
    </svg>
  );
}

function ExpensesBody() {
  // Category breakdown derived from EXPENSES (for visual consistency)
  const CATS = [
    { id: 'food',    label: '飲食',  value: 1900, color: MP.cookie },
    { id: 'medical', label: '醫療',  value: 1090, color: MP.leafDeep },
    { id: 'groom',   label: '美容',  value: 850,  color: MP.brand },
  ];
  const total = CATS.reduce((s, c) => s + c.value, 0); // 3,840
  // Sort descending so the largest slice anchors visually
  const sorted = [...CATS].sort((a, b) => b.value - a.value);

  return (
    <div style={{ padding: '4px 16px 0' }}>
      {/* Month total bar */}
      <div style={{
        padding: '14px 16px', background: MP.card,
        border: `1px solid ${MP.hairline}`, borderRadius: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 0 rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: MP.ink3, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            十一月開銷
          </div>
          <div style={{ marginTop: 2, fontFamily: SFD, fontSize: 24, fontWeight: 800, color: MP.ink, letterSpacing: -0.5 }}>
            <span style={{ fontSize: 12, color: MP.ink3, fontWeight: 600, marginRight: 4 }}>NT$</span>3,840
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 999,
          background: MP.cookieTint, color: MP.cookie,
          fontFamily: SF, fontSize: 11.5, fontWeight: 700
        }}>+12% 較上月</div>
      </div>

      {/* Category donut + legend */}
      <div style={{
        marginTop: 10, padding: '14px 14px',
        background: MP.card, border: `1px solid ${MP.hairline}`, borderRadius: 18,
        boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
        display: 'flex', alignItems: 'center', gap: 14
      }}>
        <div style={{ flexShrink: 0 }}>
          <ExpenseDonut slices={sorted} total={total} size={128}/>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            fontFamily: SF, fontSize: 12.5, fontWeight: 700, color: MP.ink,
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'
          }}>
            <span>分類占比</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: MP.ink3 }}>3 項</span>
          </div>
          {sorted.map(c => {
            const pct = Math.round((c.value / total) * 100);
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 9, height: 9, borderRadius: 3, background: c.color, flexShrink: 0
                }}/>
                <span style={{
                  fontFamily: SF, fontSize: 12.5, fontWeight: 600, color: MP.ink2, flex: 1
                }}>{c.label}</span>
                <span style={{
                  fontFamily: SFD, fontSize: 13, fontWeight: 800, color: MP.ink,
                  letterSpacing: -0.2, fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right'
                }}>{pct}%</span>
                <span style={{
                  fontFamily: SF, fontSize: 11, fontWeight: 600, color: MP.ink3,
                  fontVariantNumeric: 'tabular-nums', minWidth: 52, textAlign: 'right'
                }}>${c.value.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {EXPENSES.map(e => <ExpenseCard key={e.id} {...e}/>)}
      </div>
    </div>
  );
}

function HealthBody({ pet }) {
  return (
    <div style={{ padding: '4px 16px 0' }}>
      {/* Weight chart placeholder card */}
      <div style={{
        padding: '14px 14px 10px', background: MP.card,
        border: `1px solid ${MP.hairline}`, borderRadius: 18
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: MP.ink }}>體重趨勢</span>
          <span style={{ fontFamily: SF, fontSize: 11.5, color: MP.ink3 }}>近 6 個月</span>
        </div>
        <div style={{ marginTop: 8, position: 'relative', height: 70 }}>
          <svg viewBox="0 0 300 70" width="100%" height="70" preserveAspectRatio="none">
            <defs>
              <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MP.leafTint}/>
                <stop offset="100%" stopColor={MP.leafTint} stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d="M0 50 L50 44 L100 46 L150 38 L200 34 L250 30 L300 22 L300 70 L0 70 Z" fill="url(#wfill)"/>
            <path d="M0 50 L50 44 L100 46 L150 38 L200 34 L250 30 L300 22" fill="none" stroke={MP.leafDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            {[[0,50],[50,44],[100,46],[150,38],[200,34],[250,30],[300,22]].map(([x,y],i)=>
              <circle key={i} cx={x} cy={y} r="2.4" fill={MP.card} stroke={MP.leafDeep} strokeWidth="1.6"/>
            )}
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: SFD, fontSize: 20, fontWeight: 800, color: MP.ink, letterSpacing: -0.4 }}>
            {pet.weight}<span style={{ fontSize: 12, fontWeight: 600, color: MP.ink2 }}> 公斤</span>
          </span>
          <span style={{ fontFamily: SF, fontSize: 11.5, color: MP.leafDeep, fontWeight: 700 }}>+1.2 kg / 6m</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {HEALTH.map(h => <HealthRecord key={h.id} {...h}/>)}
      </div>
    </div>
  );
}

// ── Main screen — variants driven by props ────────────────────────
function PetsScreen({
  variant = 'list-single',   // 'list-single' | 'list-multi' | 'detail' | 'empty'
  tab = 'overview',
  showDropdown = false,
  petId = 'mango'
}) {
  if (variant === 'empty') {
    return (
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        background: MP.bg, overflow: 'hidden', fontFamily: SF, color: MP.ink
      }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingBottom: 110 }}>
          <TopBar/>
          <EmptyState/>
        </div>
        <BottomNav active="pets"/>
      </div>
    );
  }

  const isDetail = variant === 'detail';
  const isMulti = variant === 'list-multi';
  const pet = PETS.find(p => p.id === petId) || PETS[0];
  const title = isDetail ? '寵物資料' : '我的寵物';

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: MP.bg, overflow: 'hidden', fontFamily: SF, color: MP.ink
    }}>
      <div style={{
        position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden',
        paddingBottom: 200
      }}>
        <TopBar title={title}/>
        <PetHeader pet={pet} multi={isMulti || isDetail} dropdownOpen={showDropdown}/>
        <PetTabs active={tab}/>
        {tab === 'overview'  && <OverviewBody pet={pet}/>}
        {tab === 'reminders' && <RemindersBody/>}
        {tab === 'expenses'  && <ExpensesBody/>}
        {tab === 'health'    && <HealthBody pet={pet}/>}
      </div>

      {showDropdown && <PetSwitcher pets={PETS} currentId={petId}/>}

      <FloatingAdd tab={tab}/>
      <BottomNav active="pets"/>
    </div>
  );
}

// Reduced-motion: kill the dropdown-chevron rotate transition too.
if (typeof document !== 'undefined' && !document.getElementById('pets-reduced-motion')) {
  const s = document.createElement('style');
  s.id = 'pets-reduced-motion';
  s.textContent = '@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }';
  document.head.appendChild(s);
}

window.PetsScreen = PetsScreen;
window.MP = MP;
