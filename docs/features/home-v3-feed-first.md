# /app 首頁 v3 — Feed-first + Instagram Stories pets bar (Phase 3 part 1)

狀態：**GO**（user 2026-05-26 早上 prototype review 後 3 decisions confirmed）
建立日期：2026-05-26 早上
最後更新：2026-05-26 早上
規格作者：PM session @ `ece6c4c`
角色：**UI/UX**（整 stack — 元件設計 + 寫 src/ + 自驗 + per-phase commit + ship）
工作量：**M**（home page 全頁重建 + 新 stories bar 元件 + 不影響其他頁）

## 背景

Phase 3 visual-redesign-mango.md spec 太薄（只 line 284-287）。User 用 prototype-first workflow，Claude Design 產 [`docs/design/home-v2-prototype/`](../design/home-v2-prototype/) 含 5 個 variants（dashboard / feed / mixed / empty / personal），HTML 只 show 2 artboards（B1 + D1）— Claude Design 明確推 B1 Feed-first 為主方向。

PM review 結果 + user decisions：

| Decision | Final |
|---|---|
| **D1** ✅ Direction | **B1 Feed-first 推進 spec**（pets stories bar + 10 posts full + 「查看更多」CTA → `/app/feed`）|
| **D2** ⚠️ Composer entry（user 改 PM default）| **IG 模式：user 頭像在 stories bar 開頭 + 右下角 + icon overlay → tap 開 composer**（替代 FAB / top bar button）|
| **D3** ✅ Workflow | **UI/UX 直接寫 src/**（同 walks v2 / pets v2 模式，不走 patch 中介）|

## Layout（B1 base + D2 composer entry 調整）

```
HomeTopBar（compact: familyName「Mango 家庭」+ notification bell 含 unread count）
  ↓
StoriesBar（橫向 scrollable）：
  [Your] avatar + (+) overlay   →   [Mango] gradient ring + walk status   →   [Coco] ring   →   [...]
   ↑ tap = open composer        ↑ tap = filter feed by pet (future, 本 spec no-op + aria 標)
  ↓
FeedSectionHeader「最新動態 · 家人 · 朋友」+ 「查看更多」link
  ↓
PostCard list（full density，混合 family + friends + public，10 posts）
  ↓
「查看更多動態 →」CTA button → /app/feed
  ↓
BottomNav (active = 'home' tab[0])
```

### Variants 要做

| Variant | 條件 | 顯示 |
|---|---|---|
| **B1 主 (家庭 + ≥1 pet + ≥1 post)** | familyId ≠ null + pets ≥ 1 + posts ≥ 1 | Full layout above |
| **D1 empty (第一次進 / 0 pets)** | pets === 0 | EmptyStateHome 大圖 + 引導 CTA「新增第一隻寵物」 → /app/pets |
| **Personal (no family + ≥1 pet)** | familyId === null + pets ≥ 1 | B1 layout + 中段加 InviteFamilyCard upsell（personal users 看 home 不空虛）|
| **No posts edge** | pets ≥ 1 + posts === 0 | StoriesBar 仍渲染 + Feed 替換成「動態還空空 — 點頭像 + 發第一篇」hint |

## 完成標準

### 新元件（src/components/home/）

- [ ] `home-top-bar.tsx` — Compact 模式
  - Left: familyName h1 (SFD 22pt 800) + 「Mango 家庭」chip (chevron 開家庭切換 future)
  - Right: notification bell icon + unread badge (number / red dot)
  - 高 ~52px，少佔 vertical room（feed 是主角）
  - Personal mode (no family) → 顯示 user displayName 取代 familyName
- [ ] `stories-bar.tsx` — Instagram-style horizontal scrollable
  - **Slot 1 (固定第一位)**：`<YourStoryAvatar>` — user displayName avatar + 右下角 brand `+` icon overlay（24×24 圓 mango.brand bg + white + icon）
    - Tap → 開 PostComposer
    - 視覺：avatar 圓 64px + dashed border (區隔已遛/待遛 pet rings)
  - **Slot 2-N**：每隻 pet 一個 `<PetStoryAvatar>` — avatar 64px + gradient ring 編碼 today walk status
    - 已遛達標 → brand → leafDeep gradient ring
    - 待遛 / 未達標 → grey hairline ring
    - 即時 tracking 中 → brand pulsing ring (CSS keyframe)
    - 下方 pet name 11pt 600
    - Tap → 本 spec no-op + aria 標「filter feed by pet — 開發中」(future feature)
  - Horizontal scroll，padding-x 16px，gap 12px
  - Pets 從既有 Firestore listener 拿（family pets OR personal pets）
- [ ] `home-empty-state.tsx` — D1 variant
  - 140px 大圖 (radial gradient brandTint→bgAlt) + 卡通 shiba (reuse pets v2 empty state pattern)
  - 大字「歡迎來到 Mango Pet」+ 副文「新增第一隻寵物，開始記錄你家寶貝的散步、開銷、健康」
  - CTA「新增第一隻寵物」→ /app/pets (auto-open add-pet dialog via search param?)
- [ ] `invite-family-card.tsx` — Personal mode 用
  - Gradient bg (brandTint → cardSoft) + Users icon 44×44 + 標題「邀請家人加入」+ 副文「一起紀錄 Mango 的散步、開銷與健康」+ Right「邀請」brand pill button
  - Tap「邀請」→ open 既有 family invite share flow (navigator.share + clipboard fallback per family-section.tsx)
- [ ] `feed-section-header.tsx` — title + subtitle + 「查看更多」link
  - 標題「最新動態」+ subtitle「家人 · 朋友」+ Right「查看更多 →」brand-deep link → `/app/feed`

### 改既有檔

- [ ] `src/app/app/page.tsx` — **整頁重建**
  - 拿掉現有 layout (pets list section + posts section 拆開)
  - 新 layout: HomeTopBar + StoriesBar + FeedSectionHeader + PostCard list + 查看更多 CTA + BottomNav
  - Variant logic: pets.length === 0 → EmptyStateHome；familyId === null + pets ≥ 1 → 插 InviteFamilyCard
  - Reuse 既有 PostCard 元件 (沒 density prop 就用 default full density)
  - Reuse 既有 PostComposer 元件 (StoriesBar 的 user avatar + tap → open composer)
- [ ] **不動 PostCard 內部結構**（既有 hearts/comments/photo grid 全保留）
- [ ] **不動 PostComposer**（透過既有 onOpen prop）

### 既有資料 reuse

- Pets data: `listPets(familyId)` 或 `listPersonalPets(uid)` （既有 helper）
- Feed posts: `listFeedPosts(uid, friendsUids, 10)` （既有 helper per reminders-to-pets-page D2）
- Family: `useFamily()` hook
- Today walk status per pet: 需 query 該 pet 今日 walks total minutes ≥ goalMinutes
  - 沿用 `getPetWalkGoalMinutes(pet)` (per-pet-walk-goal SHIPPED)
  - **新 helper** `useTodayWalkStatus(pets)` — return `Map<petId, 'done' | 'pending' | 'tracking'>`
  - Source: 既有 walks collection group query
- Unread notification count: 既有 system（若無，本 spec **不做** notification count，bell icon 預設無 badge）

### i18n

- [ ] `messages/zh-TW.json` + `messages/en.json` 新 keys：
  - `Home.title.family`（「{familyName}」/「{familyName}」— top bar 顯示）
  - `Home.title.personal`（「{userName}」/「{userName}」— personal mode）
  - `Home.stories.yourStory`（「發文」/「Your story」— user avatar 下方 label）
  - `Home.feed.title`（「最新動態」/「Latest」）
  - `Home.feed.subtitle`（「家人 · 朋友」/「Family · Friends」）
  - `Home.feed.viewAll`（「查看更多動態」/「View all posts」）
  - `Home.empty.title`（「歡迎來到 Mango Pet」/「Welcome to Mango Pet」）
  - `Home.empty.body`（「新增第一隻寵物，開始記錄你家寶貝的散步、開銷、健康」）
  - `Home.empty.cta`（「新增第一隻寵物」/「Add first pet」）
  - `Home.inviteFamily.title`（「邀請家人加入」/「Invite family」）
  - `Home.inviteFamily.body`（「一起紀錄 {petName} 的散步、開銷與健康」）
  - `Home.inviteFamily.cta`（「邀請」/「Invite」）
  - `Home.stories.pendingWalk`（「待遛」/「Needs walk」— aria）
  - `Home.stories.doneWalk`（「已遛 ✓」/「Walked ✓」— aria）
  - `Home.stories.tracking`（「遛狗中」/「Walking now」— aria）
  - `Home.stories.filterFutureHint`（「依寵物篩選 — 開發中」/「Filter by pet — coming soon」— pet avatar aria）

### 護欄

- [ ] 不動既有 PostCard / PostComposer 內部結構（只 wire entry）
- [ ] 不動既有 feed system / friendships / family schema
- [ ] 不動既有 reminders / expenses entry（per-pet 已搬 pets page）
- [ ] 不動 bottom nav 結構（active='home' tab[0]）
- [ ] 不動 mango tokens
- [ ] 不引入新 dependencies（stories ring 用 SVG / CSS gradient，no library）
- [ ] StoriesBar pet tap = no-op + aria 標 future（不做 filter 功能）
- [ ] 不做 notification bell unread count 邏輯（若無既有 system；本 spec icon 預設 0 badge）
- [ ] EmptyState user 點「新增第一隻寵物」可 deep-link `/app/pets?action=add` (optional — pets page 也要 support search param，否則直接 navigate)

### 預驗收 checklist

- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP iPhone (`/app`)：
  - **B1 主 flow**：StoriesBar 第一位「Your」avatar + 點 → composer 開 + 後續 pets avatar 含 walk status ring + 10 posts full + 「查看更多」CTA
  - **EmptyStateHome**：登入 0 pets user → 看到 hero + 引導 CTA → 跳 `/app/pets`
  - **Personal mode**：no family + 1 pet → 看到 StoriesBar + feed + InviteFamilyCard upsell
  - **No posts edge**：≥1 pet + 0 posts → StoriesBar + feed 顯示「動態還空空 — 點頭像 + 發第一篇」hint
- [ ] Stories ring 編碼正確：
  - Today walk 已達 goal → brand → leafDeep gradient ring
  - 未達 goal → grey hairline ring
  - Tracking 中（active walk session）→ brand pulsing
- [ ] 點 stories pet avatar → 無動作 + tooltip / aria 標「依寵物篩選 — 開發中」
- [ ] reduced-motion user：pulsing ring 停 + composer 開無動畫
- [ ] Bottom nav active = 'home' tab[0]
- [ ] Lighthouse a11y on `/app` ≥ 90
- [ ] commit message: `feat(design): Phase 3 home v3 — feed-first + IG stories pets bar`
- [ ] Push to main → App Hosting auto-deploy → 5-8 min 後 user 在 production iPhone 驗收

## 不在 v3 範圍

- 點 stories pet avatar → filter feed by pet（spec 標 future no-op + aria）
- Notification bell unread count 真實邏輯（本 spec icon only）
- Notification bell tap → notification center page
- A1 Dashboard / C1 Mixed variant（Claude Design 備胎 coded，本 spec 不採用）
- Reminders 入口在 home（per pets v2「提醒」tab 主入口，避免重複）
- Family switcher chip（多 family user — future）
- Pull-to-refresh
- Infinite scroll posts（本 spec 固定 10 posts + 「查看更多」CTA）
- Stories「我的」avatar 顯示 upload progress / story 圈外環（IG-style story rings — 本 spec 純 + icon entry，沒 stories 內容系統）
- Home page 全 dark mode（Q18 跳過）
- Phase 3 other surfaces: /onboarding + Landing + sign-in（之後 separate specs）

## Edge cases

| Case | 處理 |
|---|---|
| User 0 pets | EmptyStateHome 主層 — no StoriesBar / no Feed / 完整 hero CTA → /app/pets |
| User ≥1 pet + 0 posts | StoriesBar 仍渲染 + Feed 換 hint「動態還空空 — 點頭像 + 發第一篇」 |
| Personal mode user | StoriesBar 不顯示 user 自己 family member avatars（沒家人）；中段插 InviteFamilyCard upsell |
| Family 1 人（user 自己）| 同 personal mode — InviteFamilyCard 仍顯示鼓勵邀人 |
| Stories pet walk status loading | 預設 grey hairline ring，loaded 後 transition 到正確顏色（avoid layout shift）|
| User 點 Your avatar 但無 PostComposer | （N/A — PostComposer 既有元件，本 spec 不刪）|
| Family doc loading | TopBar 顯示「載入中」placeholder，避免 flash |
| Post 沒 photo（純文字）| PostCard 既有邏輯 cover |
| Stories bar 寵物超多（> 10）| Horizontal scroll 仍 work；可接受 |
| Reduced-motion user 看 stories pulsing | Pulse stop，仍維持顏色編碼 |

## 跟其他 spec 的關聯

- **visual-redesign-mango.md (Phase 3)**：本 spec 是 Phase 3 的 part 1（home page only）；/onboarding + Landing + sign-in 是 Phase 3 part 2-4，之後 separate specs
- **walks-v2-rebuild.md / pets-v2-rebuild.md (SHIPPED)**：palette + typography + bottom nav 共用；風格一致 family
- **per-pet-walk-goal.md (SHIPPED)**：StoriesBar 算 today walk status 用 `getPetWalkGoalMinutes(pet)`
- **family-leaderboard-realtime.md (SHIPPED)**：無直接關聯但同 family aware
- **reminders-to-pets-page.md (D2)**：本 spec 沿用 D2「home 顯示 latest 10 posts + 查看更多 CTA → /app/feed」結構
- **expenses-into-pets-page.md (GO)**：home 不顯示 expenses entry（per IA 折到 pets）
- **既有 PostCard / PostComposer**：本 spec reuse 不動

## PM 觀察

工作量 **M** — 主要是新 stories bar 元件 + home page 全頁重建。比 pets v2 (L) 輕，因為：
- 大量 reuse 既有 PostCard / PostComposer / Pets helpers
- 沒 chart 元件、沒 multi-tab、沒 multi-state body
- 4 個變體都比較簡單

建議 UI/UX 1 個 session 內 ship，拆 commit：

1. `feat(home): stories-bar + your-story-avatar + pet-story-avatar (walk status ring)`
2. `feat(home): home-top-bar compact + feed-section-header + empty-state-home`
3. `feat(home): invite-family-card (personal mode upsell)`
4. `feat(home): page.tsx 全頁重建 — integrate stories bar + feed + variants logic`
5. `feat(home): useTodayWalkStatus hook (walks collection group query per pet)`
6. `chore(i18n): Home.* new keys (zh-TW + en)`

（或合 1-2 個）

## UI/UX launch prompt（user 開 UI/UX session copy 用）

```
本 session 固定角色：UI/UX — 寫 production code 動 /app 首頁 v3 重建（B1 Feed-first + IG Stories pets bar）。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/home-v3-feed-first.md（PM 寫好，含 4 variants + 完成標準 + 護欄 + edge cases + i18n keys）
- Prototype: docs/design/home-v2-prototype/
  - Home redesign.html（demo 入口 — open in browser 看 B1 + D1 artboards）
  - home-screen.jsx（5 variants 主 switch — B1 是主方向）
  - home-components.jsx + home-shared.jsx（元件 library — 直接 port StoriesBar / HomeTopBar / EmptyStateHome 等邏輯）
  - design-canvas.jsx + ios-frame.jsx（preview frame，不用拷到 production）
- 視覺風格參考（已 ship 在 production，要對齊）：
  - docs/design/walks-v2-prototype/walks-screen.jsx — palette 1:1
  - docs/design/pets-v2-prototype/pets-screen.jsx — palette 1:1
  - src/components/pets/* (pets v2 SHIPPED — pet-avatar.tsx 等可 reference photoURL fallback pattern)
  - src/components/walks/* (walks v2 SHIPPED)
- 既有 design tokens: src/app/globals.css 的 @theme inline mango palette
- 既有 home page: src/app/app/page.tsx（你會整頁重建）
- 既有 元件: src/components/feed/{post-card,post-composer}.tsx（reuse 不動內部）
- 既有 helpers: getPetWalkGoalMinutes (src/lib/walk-goals.ts) / listPets / listFeedPosts / useFamily
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4

護欄
- 動 src/app/app/page.tsx 整頁重建 OK
- 動 src/components/home/* (新檔) OK
- 動 messages/zh-TW.json + messages/en.json 加 Home.* keys OK
- 不動 PostCard / PostComposer 內部結構
- 不動 friendships / family / pets / posts schema or firebase logic
- 不動 mango tokens
- 不動 bottom nav 結構
- 不動 walks / pets / settings page
- 不引入新 dependencies
- 點 stories pet avatar = no-op + aria future（不做 filter feed by pet）
- Notification bell 不做 unread count 真實邏輯

關鍵實作筆記
- StoriesBar 第一位「Your」avatar 含右下角 `+` overlay → tap = open PostComposer（IG 模式，user D2 改 PM default）
- Pet avatar ring 編碼 walk status: done = brand→leafDeep gradient / pending = grey / tracking = brand pulsing
- useTodayWalkStatus hook: 算每隻 pet 今日 walks total minutes vs getPetWalkGoalMinutes(pet)
- EmptyState 點「新增第一隻寵物」→ /app/pets（可加 ?action=add deep-link 但需 pets page support）
- Personal mode (familyId === null) + ≥1 pet → 插 InviteFamilyCard 在 feed 上方（tap「邀請」→ open share flow）
- 4 variants logic in page.tsx：依 pets.length / familyId / posts.length 切換

實作順序
1. stories-bar.tsx + your-story-avatar.tsx + pet-story-avatar.tsx (walk status ring)
2. useTodayWalkStatus hook
3. home-top-bar.tsx compact
4. feed-section-header.tsx
5. home-empty-state.tsx (D1)
6. invite-family-card.tsx (personal mode)
7. page.tsx 全頁重建 + variants logic + 串元件
8. i18n keys 補
9. npx tsc --noEmit pass
10. dev server Chrome MCP 跑 4 variants (B1 / D1 / personal / no-posts edge)
11. commit 6 個（或合併自選）
12. push origin main → App Hosting auto-deploy

預驗收（spec 內 checklist 跑完）
- 4 variants render OK
- Stories ring 編碼 walk status 對
- 點 user avatar+ → composer 開
- 點 pet avatar → no-op + tooltip future
- EmptyState 引導 /app/pets
- Personal mode upsell card 顯示
- reduced-motion 全停 pulsing
- Lighthouse a11y 不掉

回報格式
- 每 commit hash + 1 行 review note
- 全部 ship 後 summary 給 PM 收尾 roadmap

開工。
```
