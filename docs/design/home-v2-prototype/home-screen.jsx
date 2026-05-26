// Home screen — Phase 3 redesign. Main variant switch + demo data.
//
// Variants exposed via `variant` prop:
//   'dashboard' (A1) — family summary hero · pets carousel · 5-post preview
//   'feed'      (B1) — composer prompt · 10 posts full · 「查看更多」 CTA
//   'mixed'     (C1) — mini hero · pets pill row · 3 quick actions · 3-5 posts
//   'empty'     (D1) — first-run, no pets / no posts
//   'personal'  (–)  — personal mode (no family), 1 pet, 0 posts
//
// All variants share the same TopBar + BottomNav so the page-to-page
// frame stays identical with walks-v2 / pets-v2.

const {
  MP, SF, SFD, Icon, BottomNav,
  HomeTopBar, HomeHero, PetsCarousel,
  PostCard, FeedSectionHeader, ComposerPrompt, QuickActions, EmptyStateHome,
} = window;

// ── Demo data ─────────────────────────────────────────────────────
// Two pets so the carousel has something to scroll; first one already
// walked today so we can show the dual ✓ / 待遛 state.
const PETS = [
  { id: 'mango', name: 'Mango', kind: 'shiba',    walkedToday: true,  streak: 4 },
  { id: 'coco',  name: 'Coco',  kind: 'frenchie', walkedToday: false, streak: 0 },
];

// 10 mixed feed posts (matches spec D2: family + friends + public).
// Author tint cycles through MP accents so the avatar row reads as varied
// people, not a copy-paste row. Photo'd posts get a `photo` block; text-
// only ones omit it. Times are relative + Chinese-locale.
const POSTS = [
  {
    id: 'p1', author: '媽媽', authorTint: MP.peachTint, authorInk: '#c75063',
    rel: 'family', pet: { kind: 'shiba', name: 'Mango' },
    when: '剛剛 · 公園散步',
    text: 'Mango 今天遇到一隻小柴！整路黏在一起，差點不肯回家 🐕',
    photo: { tint: MP.brandTint, ratio: 1.15, label: '大安森林公園' },
    hearts: 8, comments: 3,
  },
  {
    id: 'p2', author: '爸爸', authorTint: MP.brandTint, authorInk: MP.brandDeep,
    rel: 'family', pet: { kind: 'frenchie', name: 'Coco' },
    when: '1 小時前',
    text: 'Coco 終於肯吃新飼料了 🎉 之前試了三家都不買單，這款 Royal Canin 香味比較重。',
    hearts: 5, comments: 2,
  },
  {
    id: 'p3', author: '阿姨', authorTint: MP.leafTint, authorInk: MP.leafDeep,
    rel: 'family', pet: { kind: 'shiba', name: 'Mango' },
    when: '今天 上午 10:24',
    text: '幫 Mango 洗澡 ✨ 一身亮晶晶',
    photo: { tint: MP.peachTint, ratio: 1.3, label: '美容後' },
    hearts: 12, comments: 4,
  },
  {
    id: 'p4', author: 'Linda', authorTint: MP.brandTint, authorInk: MP.brandDeep,
    rel: 'friend', pet: { kind: 'cat', name: 'Mochi' },
    when: '昨天',
    text: 'Mochi 又把貓砂踢出來了…誰來收拾 😭',
    hearts: 3, comments: 6,
  },
  {
    id: 'p5', author: '小美', authorTint: MP.cookieTint, authorInk: MP.cookie,
    rel: 'friend', pet: { kind: 'frenchie', name: 'Bubu' },
    when: '昨天 晚上',
    text: 'Bubu 第一次去寵物友善咖啡廳，全程好乖 ☕',
    photo: { tint: MP.cookieTint, ratio: 1.4, label: 'Pawsome Café' },
    hearts: 14, comments: 5,
  },
  {
    id: 'p6', author: '阿宏', authorTint: MP.leafTint, authorInk: MP.leafDeep,
    rel: 'public',
    when: '2 天前',
    text: '請問大家秋天柴犬掉毛怎麼處理…家裡每天都掃一袋 😅 有推薦的梳子嗎？',
    hearts: 21, comments: 18,
  },
  {
    id: 'p7', author: 'Jay', authorTint: MP.peachTint, authorInk: '#c75063',
    rel: 'friend', pet: { kind: 'shiba', name: 'Mango' },
    when: '2 天前',
    text: '陪 Mango 走了 5 公里，腳痠的是我 🥲',
    photo: { tint: MP.leafTint, ratio: 1.1, label: '河堤步道' },
    hearts: 9, comments: 2,
  },
  {
    id: 'p8', author: '哥', authorTint: MP.brandTint, authorInk: MP.brandDeep,
    rel: 'family',
    when: '3 天前',
    text: '本月 Mango + Coco 開銷已破 6000 NTD…該不該縮減零食預算 🤔',
    hearts: 4, comments: 8,
  },
  {
    id: 'p9', author: 'Anna', authorTint: MP.leafTint, authorInk: MP.leafDeep,
    rel: 'public', pet: { kind: 'cat', name: 'Sushi' },
    when: '4 天前',
    text: 'Sushi 從窗台跳下來時居然會看路了，恭喜長大 🐱',
    photo: { tint: MP.peachTint, ratio: 1, label: '客廳' },
    hearts: 31, comments: 9,
  },
  {
    id: 'p10', author: '阿婆', authorTint: MP.cookieTint, authorInk: MP.cookie,
    rel: 'family', pet: { kind: 'frenchie', name: 'Coco' },
    when: '5 天前',
    text: 'Coco 又偷吃了我的拖鞋 😡 第三雙。',
    hearts: 7, comments: 11,
  },
];

// ── Sticky composer FAB — present in A & C variants so users can post
// without scrolling to the feed. B uses the inline prompt instead.
function ComposerFab() {
  return (
    <button style={{
      position: 'absolute', right: 18, bottom: 104, zIndex: 6,
      width: 54, height: 54, borderRadius: '50%',
      border: 'none',
      background: `linear-gradient(180deg, ${MP.brand} 0%, ${MP.brandDeep} 100%)`,
      color: MP.ink,
      display: 'grid', placeItems: 'center',
      boxShadow: '0 16px 28px -8px rgba(243,152,0,0.55), 0 4px 10px -4px rgba(180,100,0,0.30), inset 0 1px 0 rgba(255,255,255,0.4)',
    }}>{Icon.pen(22)}</button>
  );
}

// ── Variant A: Dashboard 風 ───────────────────────────────────────
function DashboardBody({ posts }) {
  return (
    <>
      <HomeHero
        greeting="早安 · Mango 一家"
        summary="今天 1 人遛狗、2 條提醒待辦、本月 3 筆新開銷。"
        stats={[
          { icon: Icon.paw(15),    tint: MP.brandTint, color: MP.brandDeep, value: '1/2', label: '今日已遛' },
          { icon: Icon.bell(15),   tint: MP.peachTint, color: '#c75063',    value: '2',   label: '提醒到期' },
          { icon: Icon.cookie(15), tint: MP.cookieTint, color: MP.cookie,   value: '6.1', unit: 'K', label: '本月開銷' },
        ]}
      />

      <div style={{ padding: '20px 0 10px' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '0 20px 10px',
        }}>
          <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 800, color: MP.ink }}>寵物</span>
          <span style={{ fontFamily: SF, fontSize: 12.5, fontWeight: 700, color: MP.brandDeep }}>
            管理 <span style={{ marginLeft: 2 }}>{Icon.chev(10)}</span>
          </span>
        </div>
        <PetsCarousel pets={PETS} mode="rich"/>
      </div>

      <div style={{ padding: '10px 0 0' }}>
        <FeedSectionHeader title="最新動態" subtitle="家人 · 朋友" more="查看更多"/>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.slice(0, 5).map(p => <PostCard key={p.id} post={p} density="preview"/>)}
        </div>
      </div>
    </>
  );
}

// ── Variant B: Feed-first ─────────────────────────────────────────
function FeedBody({ posts }) {
  return (
    <>
      {/* horizontal pets bar — Instagram-stories style: circular avatars
          with gradient rings encoding today's walk status. Click an avatar
          to filter the feed to that pet (future). */}
      <div style={{ padding: '10px 0 16px' }}>
        <PetsCarousel pets={PETS} mode="stories"/>
      </div>

      {/* feed — full density */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.map(p => <PostCard key={p.id} post={p} density="full"/>)}
      </div>

      {/* end-of-feed CTA → /app/feed */}
      <div style={{ padding: '16px 16px 0' }}>
        <button style={{
          width: '100%', height: 48, borderRadius: 14,
          background: MP.card, color: MP.brandDeep,
          border: `1.5px solid ${MP.brandTint}`,
          fontFamily: SF, fontSize: 14.5, fontWeight: 800, letterSpacing: -0.1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>查看更多動態 {Icon.chev(12)}</button>
      </div>
    </>
  );
}

// ── Variant C: 混合 ──────────────────────────────────────────────
function MixedBody({ posts }) {
  return (
    <>
      {/* mini hero — one-line summary + pets pill row stacked */}
      <div style={{ padding: '4px 20px 14px' }}>
        <p style={{
          margin: 0, fontFamily: SFD, fontSize: 20, fontWeight: 800,
          color: MP.ink, letterSpacing: -0.4, lineHeight: 1.25,
        }}>
          早安 — Mango 待遛，<br/>Coco 今天已陪走 1.8 公里 ✨
        </p>
      </div>

      <PetsCarousel pets={PETS} mode="pills"/>

      <div style={{ padding: '18px 0 4px' }}>
        <div style={{
          padding: '0 20px 10px',
          fontFamily: SF, fontSize: 14, fontWeight: 800, color: MP.ink,
        }}>快速動作</div>
        <QuickActions/>
      </div>

      <div style={{ padding: '18px 0 0' }}>
        <FeedSectionHeader title="動態" subtitle="家人最新分享" more="查看更多"/>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.slice(0, 4).map((p, i) =>
            <PostCard key={p.id} post={p} density={i === 0 ? 'full' : 'preview'}/>
          )}
        </div>
      </div>
    </>
  );
}

// ── Variant E: Personal (no family, 1 pet, 0 posts) ──────────────
// Same chrome as A but with the family pill swapped for a single pet
// pill and the feed section replaced by an invite-family card.
function PersonalBody() {
  const onlyPet = [PETS[0]];
  return (
    <>
      <HomeHero
        greeting="早安 · Mango"
        summary="今天還沒散步，再走 30 分鐘就達標。"
        stats={[
          { icon: Icon.paw(15),    tint: MP.brandTint, color: MP.brandDeep, value: '0', unit: '/2', label: '今日已遛' },
          { icon: Icon.bell(15),   tint: MP.peachTint, color: '#c75063',    value: '1',             label: '提醒到期' },
          { icon: Icon.cookie(15), tint: MP.cookieTint, color: MP.cookie,   value: '1.6', unit: 'K',label: '本月開銷' },
        ]}
      />

      <div style={{ padding: '20px 0 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '0 20px 10px',
        }}>
          <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 800, color: MP.ink }}>我的寵物</span>
          <span style={{ fontFamily: SF, fontSize: 12.5, fontWeight: 700, color: MP.brandDeep }}>
            管理 {Icon.chev(10)}
          </span>
        </div>
        <PetsCarousel pets={onlyPet} mode="rich"/>
      </div>

      {/* invite-family upsell card — replaces the empty feed in personal mode */}
      <div style={{ padding: '6px 16px 0' }}>
        <div style={{
          background: `linear-gradient(135deg, ${MP.brandTint} 0%, ${MP.cardSoft} 100%)`,
          border: `1px solid ${MP.hairline}`, borderRadius: 18,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: MP.card, color: MP.brandDeep,
            display: 'grid', placeItems: 'center',
            boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
          }}>{Icon.users(20)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 800, color: MP.ink, letterSpacing: -0.1 }}>
              邀請家人加入
            </div>
            <div style={{ fontFamily: SF, fontSize: 12, color: MP.ink2, marginTop: 2, lineHeight: 1.4 }}>
              一起紀錄 Mango 的散步、開銷與健康。
            </div>
          </div>
          <button style={{
            height: 34, padding: '0 14px', borderRadius: 999,
            background: MP.brand, color: MP.ink, border: 'none',
            fontFamily: SF, fontSize: 13, fontWeight: 800, letterSpacing: -0.1,
          }}>邀請</button>
        </div>
      </div>

      {/* gentle nudge — your feed is quiet, post first */}
      <div style={{ padding: '14px 20px 0', textAlign: 'center' }}>
        <div style={{ fontFamily: SF, fontSize: 12.5, color: MP.ink3 }}>
          動態還空空的 — 發第一篇貼文，邀請的家人就能看到 ✨
        </div>
      </div>
    </>
  );
}

// ── Main switch ───────────────────────────────────────────────────
function HomeScreen({ variant = 'dashboard' }) {
  const isEmpty = variant === 'empty';
  const isPersonal = variant === 'personal';

  // Top bar varies: empty has no family, personal has no family,
  // feed-first uses compact title to save vertical room.
  let topBarProps;
  if (isEmpty)       topBarProps = { familyName: null, notify: 0, compact: false };
  else if (isPersonal) topBarProps = { familyName: null, notify: 1, compact: false };
  else if (variant === 'feed') topBarProps = { familyName: 'Mango 家庭', notify: 5, compact: true };
  else                 topBarProps = { familyName: 'Mango 家庭', notify: 2, compact: false };

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: MP.bg, overflow: 'hidden',
      fontFamily: SF, color: MP.ink,
    }}>
      <div style={{
        position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden',
        // generous bottom pad to clear the 88px nav + a comfy 40px buffer
        paddingBottom: 140,
      }}>
        <HomeTopBar {...topBarProps}/>

        {variant === 'dashboard' && <DashboardBody posts={POSTS}/>}
        {variant === 'feed'      && <FeedBody posts={POSTS}/>}
        {variant === 'mixed'     && <MixedBody posts={POSTS}/>}
        {variant === 'empty'     && <EmptyStateHome/>}
        {variant === 'personal'  && <PersonalBody/>}
      </div>

      {/* Composer FAB on A + C only. B intentionally skips it (clean feed
          surface, user opens composer from the bottom-nav 發文 entry); D
          + personal also skip it (no audience / no content yet). */}
      {(variant === 'dashboard' || variant === 'mixed') && <ComposerFab/>}

      <BottomNav active="home"/>
    </div>
  );
}

window.HomeScreen = HomeScreen;
