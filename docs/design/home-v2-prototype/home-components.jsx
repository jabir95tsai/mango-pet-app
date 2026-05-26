// Home screen — Phase 3 redesign. Reusable building blocks.
// Each piece is variant-agnostic; HomeScreen composes them differently.

const { MP, SF, SFD, Icon, PetMini, PersonAvatar } = window;

// ─────────────────────────────────────────────────────────────
// HomeTopBar — title「🥭 Mango」+ family pill (left) · bell (right)
// `compact` collapses the title row for variants that lead with a feed.
// ─────────────────────────────────────────────────────────────
function HomeTopBar({ familyName = 'Mango 家庭', notify = 2, compact = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: compact ? '12px 16px 4px' : '14px 20px 4px',
    }}>
      <div style={{
        fontFamily: SFD, fontSize: compact ? 20 : 26, fontWeight: 800,
        color: MP.ink, letterSpacing: -0.6, lineHeight: 1,
      }}>
        🥭 <span style={{ marginLeft: 2 }}>Mango</span>
      </div>
      {familyName && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 11px 5px 7px', borderRadius: 999,
          background: MP.card, border: `1px solid ${MP.hairline}`,
          fontFamily: SF, fontSize: 12.5, fontWeight: 700, color: MP.ink2,
          boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
        }}>
          <span style={{ color: MP.brandDeep, display: 'inline-flex' }}>{Icon.home(11)}</span>
          {familyName}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <button style={{
        position: 'relative', width: 38, height: 38, borderRadius: '50%',
        background: MP.card, border: `1px solid ${MP.hairline}`,
        color: MP.ink2, display: 'grid', placeItems: 'center',
      }}>
        {Icon.bell(18)}
        {notify > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
            background: MP.brand, color: '#fff',
            fontFamily: SFD, fontSize: 10, fontWeight: 800,
            display: 'grid', placeItems: 'center',
            boxShadow: '0 0 0 2px ' + MP.card,
          }}>{notify}</span>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HomeHero — big greeting + 1-line summary + 3 inline stat chips.
// Used by variant A. The chips link mentally to the 3 most-touched
// surfaces (walks / reminders / expenses).
// ─────────────────────────────────────────────────────────────
function HomeHero({ greeting, summary, stats }) {
  return (
    <div style={{ padding: '6px 20px 0' }}>
      <h1 style={{
        margin: 0, fontFamily: SFD, fontSize: 26, fontWeight: 800,
        color: MP.ink, letterSpacing: -0.6, lineHeight: 1.15,
      }}>{greeting}</h1>
      <p style={{
        margin: '6px 0 0', fontFamily: SF, fontSize: 13.5, fontWeight: 500,
        color: MP.ink2, lineHeight: 1.5,
      }}>{summary}</p>

      {/* 3-up stat chips. Cream cards on bg, hairline border. */}
      <div style={{
        marginTop: 14,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: MP.card, border: `1px solid ${MP.hairline}`,
            borderRadius: 16, padding: '10px 10px',
            boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 20px -18px rgba(80,50,10,0.20)',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 8,
              background: s.tint, color: s.color,
            }}>{s.icon}</div>
            <div style={{
              fontFamily: SFD, fontSize: 20, fontWeight: 800,
              color: MP.ink, letterSpacing: -0.5, lineHeight: 1,
            }}>
              {s.value}
              {s.unit && <span style={{
                fontSize: 11, fontWeight: 600, color: MP.ink2, marginLeft: 2,
              }}>{s.unit}</span>}
            </div>
            <div style={{
              fontFamily: SF, fontSize: 11, fontWeight: 600,
              color: MP.ink3, letterSpacing: 0.2, textTransform: 'uppercase',
            }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PetsCarousel — horizontally-scrolling pet rail.
//   mode 'rich'    → 96-wide cards w/ today walk status chip (variant A)
//   mode 'pills'   → tighter chip row (variant C)
//   mode 'stories' → Instagram-stories style ring + circular avatar (variant B)
//                    Ring colour encodes today walk status:
//                      not-walked = brand orange→pink gradient (attention)
//                      walked     = soft leaf gradient (chill / done)
// ─────────────────────────────────────────────────────────────
function PetsCarousel({ pets, mode = 'rich' }) {
  if (mode === 'stories') {
    return (
      <div style={{
        padding: '0 4px 0 16px',
        display: 'flex', gap: 14, overflowX: 'auto', overflowY: 'hidden',
      }}>
        {/* "Your story" — own/add pet */}
        <div style={{
          flexShrink: 0, width: 68,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: MP.bgAlt, border: `1.5px dashed ${MP.brand}`,
            color: MP.brandDeep, display: 'grid', placeItems: 'center',
            position: 'relative',
          }}>
            {Icon.plus(22)}
          </div>
          <span style={{
            fontFamily: SF, fontSize: 11, fontWeight: 700, color: MP.ink2,
            maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>新增</span>
        </div>

        {pets.map((p) => {
          const gradient = p.walkedToday
            ? `conic-gradient(from 200deg, ${MP.leaf}, ${MP.leafDeep}, ${MP.leaf})`
            : `conic-gradient(from 200deg, ${MP.brand}, ${MP.peach}, ${MP.cookie}, ${MP.brand})`;
          return (
            <div key={p.id} style={{
              flexShrink: 0, width: 68,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              {/* Story ring: gradient outer, white pad, avatar inner. The
                  3-layer rings match Instagram's recipe so the visual is
                  instantly recognizable. */}
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                padding: 2.5, background: gradient,
                position: 'relative',
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  padding: 2, background: MP.bg,
                  boxSizing: 'border-box',
                }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    overflow: 'hidden',
                  }}>
                    <PetMini pet={p} size={55}/>
                  </div>
                </div>
                {/* Streak badge bottom-right when active */}
                {p.streak > 0 && (
                  <div style={{
                    position: 'absolute', right: -2, bottom: -2,
                    minWidth: 22, height: 22, padding: '0 5px', borderRadius: 999,
                    background: MP.card, color: MP.brandDeep,
                    border: `1.5px solid ${MP.bg}`,
                    display: 'inline-flex', alignItems: 'center', gap: 1,
                    fontFamily: SFD, fontSize: 10.5, fontWeight: 800,
                    boxShadow: '0 2px 6px -2px rgba(80,50,10,0.25)',
                  }}>
                    {Icon.flame(10)}{p.streak}
                  </div>
                )}
              </div>
              <span style={{
                fontFamily: SF, fontSize: 11.5,
                fontWeight: p.walkedToday ? 600 : 800,
                color: p.walkedToday ? MP.ink2 : MP.ink,
                maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                letterSpacing: -0.1,
              }}>{p.name}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (mode === 'pills') {
    return (
      <div style={{
        padding: '0 20px',
        display: 'flex', gap: 8, overflowX: 'auto', overflowY: 'hidden',
      }}>
        {pets.map((p) => (
          <div key={p.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 12px 6px 6px', borderRadius: 999,
            background: MP.card, border: `1px solid ${MP.hairline}`,
            flexShrink: 0,
          }}>
            <PetMini pet={p} size={28}/>
            <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: MP.ink }}>
              {p.name}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 999,
              background: p.walkedToday ? MP.leafTint : MP.brandTint,
              color: p.walkedToday ? MP.leafDeep : MP.brandDeep,
              fontFamily: SF, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3,
            }}>
              {p.walkedToday ? '已遛' : '待遛'}
            </span>
          </div>
        ))}
        <button style={{
          flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
          background: MP.brandTint, color: MP.brandDeep,
          border: 'none', display: 'grid', placeItems: 'center',
        }}>{Icon.plus(18)}</button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '0 20px',
      display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden',
    }}>
      {pets.map((p) => (
        <div key={p.id} style={{
          flexShrink: 0, width: 96,
          background: MP.card, border: `1px solid ${MP.hairline}`,
          borderRadius: 18, padding: '12px 10px 10px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 20px -18px rgba(80,50,10,0.18)',
          position: 'relative',
        }}>
          <PetMini pet={p} size={56}/>
          {/* corner streak */}
          {p.streak > 0 && (
            <div style={{
              position: 'absolute', top: 8, right: 8,
              display: 'inline-flex', alignItems: 'center', gap: 1,
              padding: '2px 5px 2px 3px', borderRadius: 999,
              background: MP.brandTint, color: MP.brandDeep,
              fontFamily: SF, fontSize: 9.5, fontWeight: 800,
            }}>
              {Icon.flame(10)}{p.streak}
            </div>
          )}
          <div style={{
            fontFamily: SF, fontSize: 13, fontWeight: 700, color: MP.ink,
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{p.name}</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 8px', borderRadius: 999,
            background: p.walkedToday ? MP.leafTint : MP.brandTint,
            color: p.walkedToday ? MP.leafDeep : MP.brandDeep,
            fontFamily: SF, fontSize: 10, fontWeight: 800, letterSpacing: 0.3,
          }}>
            {p.walkedToday ? '✓ 今天已遛' : '待遛'}
          </div>
        </div>
      ))}
      {/* + add pet card */}
      <div style={{
        flexShrink: 0, width: 96,
        background: 'transparent',
        border: `1.5px dashed ${MP.hairline}`,
        borderRadius: 18, padding: '12px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
        color: MP.brandDeep,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: MP.brandTint, display: 'grid', placeItems: 'center',
        }}>{Icon.plus(18)}</div>
        <span style={{ fontFamily: SF, fontSize: 11.5, fontWeight: 700 }}>新增寵物</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PostCard — single feed entry. Three densities:
//   'full'    → photo + caption + reactions (variant B main feed)
//   'preview' → no photo / 2-line caption clamp (variant A & C)
//   'compact' → 1-line row (currently unused, reserved)
// ─────────────────────────────────────────────────────────────
const REL_TONES = {
  family:  { bg: MP.peachTint, ink: '#c75063', icon: Icon.home(11), label: '家人' },
  friend:  { bg: MP.brandTint, ink: MP.brandDeep, icon: Icon.users(11), label: '朋友' },
  public:  { bg: MP.leafTint,  ink: MP.leafDeep,  icon: Icon.globe(11), label: '公開' },
};

function RelChip({ kind }) {
  const t = REL_TONES[kind] || REL_TONES.public;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px 2px 5px', borderRadius: 999,
      background: t.bg, color: t.ink,
      fontFamily: SF, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.2,
      lineHeight: 1,
    }}>
      {t.icon}{t.label}
    </span>
  );
}

// Photo placeholder — a soft tinted block w/ a faint paw mark. We don't
// invent real photos; the production app drops in user uploads here.
function PhotoBlock({ tint = MP.brandTint, ratio = 1, label }) {
  return (
    <div style={{
      width: '100%', aspectRatio: String(ratio),
      background: `linear-gradient(135deg, ${tint} 0%, ${MP.bgAlt} 100%)`,
      borderRadius: 14, overflow: 'hidden', position: 'relative',
      display: 'grid', placeItems: 'center',
    }}>
      <div style={{ color: MP.ink3, opacity: 0.35, transform: 'scale(2.4)' }}>
        {Icon.paw(28)}
      </div>
      {label && (
        <div style={{
          position: 'absolute', left: 10, bottom: 10,
          padding: '3px 8px', borderRadius: 999,
          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)',
          fontFamily: SF, fontSize: 10.5, fontWeight: 700, color: MP.ink2,
        }}>{label}</div>
      )}
    </div>
  );
}

function PostCard({ post, density = 'full' }) {
  const { author, authorTint, authorInk, pet, rel, when, text, photo, hearts, comments } = post;
  const isPreview = density === 'preview';
  return (
    <div style={{
      background: MP.card, border: `1px solid ${MP.hairline}`, borderRadius: 18,
      padding: '12px 14px ' + (isPreview ? '12px' : '12px'),
      boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 22px -18px rgba(80,50,10,0.18)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* author row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PersonAvatar name={author} color={authorTint || MP.brandTint} ink={authorInk || MP.brandDeep} size={36}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 700, color: MP.ink, letterSpacing: -0.1 }}>
              {author}
            </span>
            <RelChip kind={rel}/>
            {pet && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 7px 2px 3px', borderRadius: 999,
                background: MP.bgAlt, color: MP.ink2,
                fontFamily: SF, fontSize: 10.5, fontWeight: 700,
              }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', overflow: 'hidden', display: 'inline-block' }}>
                  <PetMini pet={pet} size={16}/>
                </span>
                {pet.name}
              </span>
            )}
          </div>
          <div style={{ fontFamily: SF, fontSize: 11.5, color: MP.ink3, marginTop: 2 }}>{when}</div>
        </div>
      </div>

      {/* text */}
      {text && (
        <p style={{
          margin: 0, fontFamily: SF, fontSize: 14, color: MP.ink, lineHeight: 1.45,
          display: '-webkit-box', WebkitBoxOrient: 'vertical',
          WebkitLineClamp: isPreview ? 2 : 5,
          overflow: 'hidden', textOverflow: 'ellipsis',
          textWrap: 'pretty',
        }}>{text}</p>
      )}

      {/* photo (full density only) */}
      {!isPreview && photo && (
        <PhotoBlock tint={photo.tint} ratio={photo.ratio || 1.2} label={photo.label}/>
      )}

      {/* reactions row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        fontFamily: SF, fontSize: 12.5, fontWeight: 600, color: MP.ink3,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: hearts > 0 ? '#c75063' : MP.ink3 }}>
          {Icon.heart(15, hearts > 0)}{hearts}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {Icon.chat(15)}{comments}
        </span>
        <div style={{ flex: 1 }} />
        {isPreview && (
          <span style={{ color: MP.brandDeep, fontWeight: 700 }}>讀更多 →</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FeedSectionHeader — small「動態」row + 「查看更多」CTA → /app/feed
// ─────────────────────────────────────────────────────────────
function FeedSectionHeader({ title = '動態', subtitle, more = '查看更多' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '0 20px 10px',
    }}>
      <div>
        <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 800, color: MP.ink, letterSpacing: -0.1 }}>
          {title}
        </span>
        {subtitle && <span style={{ fontFamily: SF, fontSize: 12, color: MP.ink3, marginLeft: 8 }}>{subtitle}</span>}
      </div>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontFamily: SF, fontSize: 12.5, fontWeight: 700, color: MP.brandDeep,
      }}>{more} <span style={{ marginTop: 1 }}>{Icon.chev(10)}</span></span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ComposerPrompt — Instagram-style "what's up" bar.
// Used by variant B (full-width pill) and variant C (inline).
// ─────────────────────────────────────────────────────────────
function ComposerPrompt({ userName = '你', userTint = MP.leafTint, userInk = MP.leafDeep }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: MP.card, border: `1px solid ${MP.hairline}`,
      borderRadius: 999,
      boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
    }}>
      <PersonAvatar name={userName} color={userTint} ink={userInk} size={32}/>
      <span style={{
        flex: 1, fontFamily: SF, fontSize: 14, color: MP.ink3, letterSpacing: -0.1,
      }}>來分享吧…</span>
      <button style={{
        width: 36, height: 36, borderRadius: '50%',
        background: MP.brandTint, color: MP.brandDeep, border: 'none',
        display: 'grid', placeItems: 'center',
      }}>{Icon.camera(18)}</button>
      <button style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'transparent', color: MP.ink2, border: `1px solid ${MP.hairline}`,
        display: 'grid', placeItems: 'center',
      }}>{Icon.pen(16)}</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QuickActions — 3 large action tiles (variant C). Each tile is a
// shortcut to the most-touched verbs: 拍收據 / 發文 / 開始遛狗.
// ─────────────────────────────────────────────────────────────
function QuickActions() {
  const actions = [
    { icon: Icon.receipt(22), label: '拍收據', tint: MP.cookieTint, ink: MP.cookie, hint: 'AI 自動分類' },
    { icon: Icon.pen(22),     label: '發文',   tint: MP.brandTint,  ink: MP.brandDeep, hint: '分享給家人' },
    { icon: Icon.paw(22),     label: '遛狗',   tint: MP.leafTint,   ink: MP.leafDeep, hint: '開始紀錄' },
  ];
  return (
    <div style={{
      padding: '0 16px',
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
    }}>
      {actions.map((a, i) => (
        <button key={i} style={{
          background: MP.card, border: `1px solid ${MP.hairline}`,
          borderRadius: 18, padding: '14px 10px 12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 22px -18px rgba(80,50,10,0.18)',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: a.tint, color: a.ink,
            display: 'grid', placeItems: 'center',
          }}>{a.icon}</div>
          <div style={{ fontFamily: SFD, fontSize: 14, fontWeight: 800, color: MP.ink, letterSpacing: -0.2 }}>
            {a.label}
          </div>
          <div style={{ fontFamily: SF, fontSize: 10.5, fontWeight: 600, color: MP.ink3, letterSpacing: 0.2 }}>
            {a.hint}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EmptyStateHome — first-run, no pet + no posts. Big paw + 2 CTAs.
// Personal-mode equivalent (1 pet, 0 posts) reuses parts of this via
// HomeScreen prop overrides instead of a separate component.
// ─────────────────────────────────────────────────────────────
function EmptyStateHome() {
  return (
    <div style={{
      padding: '20px 28px 0', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      {/* hero illustration — soft halo behind a shiba */}
      <div style={{
        width: 168, height: 168, borderRadius: '50%',
        background: `radial-gradient(circle at 50% 35%, ${MP.brandTint} 0%, ${MP.bgAlt} 70%, transparent 100%)`,
        display: 'grid', placeItems: 'center', position: 'relative',
        marginTop: 8,
      }}>
        <PetMini pet={{ kind: 'shiba' }} size={120}/>
        {/* decorative bits */}
        <div style={{ position: 'absolute', top: 8, left: 18, width: 8, height: 8, borderRadius: 2, background: MP.brand, transform: 'rotate(20deg)' }}/>
        <div style={{ position: 'absolute', bottom: 18, right: 14, width: 6, height: 12, borderRadius: 2, background: MP.leaf, transform: 'rotate(-15deg)' }}/>
        <div style={{ position: 'absolute', top: 30, right: 6, width: 6, height: 6, borderRadius: '50%', background: MP.peach }}/>
      </div>

      <div style={{
        fontFamily: SFD, fontSize: 24, fontWeight: 800,
        color: MP.ink, letterSpacing: -0.5, marginTop: 4,
      }}>歡迎來到 Mango</div>
      <p style={{
        margin: 0, maxWidth: 290,
        fontFamily: SF, fontSize: 14, fontWeight: 500,
        color: MP.ink2, lineHeight: 1.55, textWrap: 'pretty',
      }}>新增第一隻寵物，就能開始紀錄散步、健康與開銷，並把美好時刻分享給家人。</p>

      {/* primary + secondary actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280, marginTop: 10 }}>
        <button style={{
          height: 52, borderRadius: 999, border: 'none',
          background: `linear-gradient(180deg, ${MP.brand} 0%, ${MP.brandDeep} 100%)`,
          color: MP.ink,
          fontFamily: SFD, fontSize: 16, fontWeight: 800, letterSpacing: -0.2,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 16px 28px -10px rgba(243,152,0,0.55), 0 3px 8px -3px rgba(180,100,0,0.30)',
        }}>{Icon.plus(18)}新增寵物</button>
        <button style={{
          height: 48, borderRadius: 999,
          background: 'transparent', color: MP.ink,
          border: `1.5px solid ${MP.hairline}`,
          fontFamily: SF, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {Icon.users(14)}<span style={{ marginLeft: 2 }}>加入家庭</span>
        </button>
      </div>

      {/* tiny how-it-works strip */}
      <div style={{
        marginTop: 18, width: '100%',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        textAlign: 'left',
      }}>
        {[
          { n: 1, t: '新增寵物', s: '名字 · 品種 · 體重' },
          { n: 2, t: '邀請家人', s: '一起紀錄' },
          { n: 3, t: '開始遛狗', s: '解鎖數據與排行' },
        ].map((step) => (
          <div key={step.n} style={{
            background: MP.card, border: `1px solid ${MP.hairline}`,
            borderRadius: 14, padding: '10px 10px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: MP.brandTint, color: MP.brandDeep,
              display: 'grid', placeItems: 'center',
              fontFamily: SFD, fontSize: 12, fontWeight: 800,
            }}>{step.n}</div>
            <div style={{ fontFamily: SF, fontSize: 12.5, fontWeight: 800, color: MP.ink, letterSpacing: -0.1 }}>{step.t}</div>
            <div style={{ fontFamily: SF, fontSize: 10.5, fontWeight: 600, color: MP.ink3, letterSpacing: 0.2 }}>{step.s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  HomeTopBar, HomeHero, PetsCarousel,
  PostCard, RelChip, PhotoBlock, FeedSectionHeader,
  ComposerPrompt, QuickActions, EmptyStateHome,
});
