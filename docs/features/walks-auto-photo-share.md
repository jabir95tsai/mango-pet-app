# 遛狗自動拍照 + 自動發動態（walks auto-photo share）

狀態：**SHIPPED 2026-05-25**（6 commits `5ecbe38` → `a03caf9`；無 functions / 無 rules 改動；frontend 一個 push）
建立日期：2026-05-25
最後更新：2026-05-25
規格作者：PM session @ `6fddd19`
角色：**Feature Builder**（整 stack — UI prompt sheet + camera reuse + post composer reuse + Firebase Storage + Firestore writes + Settings toggle + i18n）
工作量：**M**

## SHIPPED bookkeeping

| Commit | What |
|---|---|
| `5ecbe38` | feat(types): schema — `AppUser.walkPrefs.autoPhotoShare` (optional; absent = ON) + `Post.walkId` (optional). Helpers: `updateWalkAutoPhotoShare(uid, enabled)`, `mintWalkId()`, and `createWalk` gains optional pre-minted `walkId` (setDoc path) so START post can cross-link before the walk doc exists. **firestore.rules unchanged** — existing user-update + posts-create rules already cover walkPrefs / walkId writes (no field gating). |
| `f0fdd61` | feat(walks): `PhotoPromptSheet` bottom-sheet component + i18n. z-60 stacks above walk-tracking-view's z-40 + confetti. Slide-up keyframe in globals.css; collapses under `prefers-reduced-motion`. Backdrop + Esc both route to onSkip. i18n: `WalksPhotoPrompt.*` + `Settings.walkAutoPhoto.*` (both locales). |
| `22801f9` | feat(composer): `PostComposer` gains 3 optional props (`initialPhoto`, `initialCaption`, `walkId`). Open-state seed effect handles both initial-* in one place. Freehand path unchanged (all props optional). |
| `9e8f7ae` | feat(walks): start-photo flow on walks page. `handleStartWalking` mints walkId → reads pref → sheet or direct-to-tracking. Camera input dismissal == Skip. Widens `WalkTrackingView.onComplete` + `ManualWalkDialog.onSubmit` return to `Promise<{walkId} \| null \| void>` so the end-flow can read the walkId. |
| `94135f5` | feat(walks): end-photo flow inside walk-tracking-view. 1s delay after `phase === "done"` (don't interrupt confetti); reads autoPhotoShare pref + loads composer pets list inside view; saveWalkOnce captures walkId from onComplete result for the END post cross-link. |
| `a03caf9` | feat(settings): `WalkAutoPhotoSection` toggle — Tailwind switch matching EngagementPushSection. Default ON via absent-fallback; only explicit `false` opts out. Optimistic update + rollback. |

### 後續驗證 / 觀察

Bug Hunter session 2026-05-26 desktop Chrome MCP 驗：
- iOS PWA real-device test (4 flows, the only environment that exercises capture="environment"):
  - START prompt → 拍照 → composer → publish → /app/feed ⏳ (需 iPhone)
  - START prompt → 跳過 → tracking ✅ (desktop: prompt sheet 升起、點跳過 → tracking 00:03 開始)
  - END prompt (1s after confetti) → 拍照 → composer → publish → /app/feed ⏳ (需 iPhone)
  - END prompt → 跳過 → done screen interactive ✅ (desktop: 1s delay 後 prompt 升起、點跳過 → done screen 仍可點 [回到遛狗] [查看排行榜])
- Settings toggle OFF → next walk: zero prompts at either phase ✅ (desktop: toggle 翻 OFF persist 過、回 walks 點開始遛狗直進 tracking、點停止 done screen render 等 3s 無 end prompt)
- Camera permission denied: OS dismissed file picker → treated as Skip, tracking starts (start) / done screen stays interactive (end) ⏳ (需 iPhone real perm denial; desktop 上 fake-file inject 過 composer flow 對)
- Two posts in feed with same `walkId` (pre-minted on START, used by createWalk on save, used by END composer) ✅ code review — walks/page.tsx:149/264/687、post-composer.tsx:151、posts.ts:71 wire-up 完整 (運行時驗證需 iPhone publish 後 query feed)
- reduced-motion users: sheet snap-appears (no slide-up) per global rule ⏳
- composer initialPhoto + initialCaption pre-fill ✅ (desktop: inject 1×1 PNG → composer 開、caption「Mango 開始遛狗 🐾」+ 1/4 photo preview + Mango/錢錢 pet tags)
- composer cancel → tracking auto-start edge case ✅ (desktop: 點取消 → tracking 00:04 計時器跑)
- console clean of real errors (Chrome extension noise excluded) ✅
- `npx tsc --noEmit` clean ✅

Polish 觀察（非 spec 範圍、寫進 backlog 等 PM 排序）：
- 短 walk (< 1 min) 結束 prompt body 顯示「走了 0 分」— `Math.floor(seconds/60)` round down，可考慮 `Math.max(1, ...)` 或 round to nearest
- Spec line 91 寫「Privacy 預設 family-only（對齊既有 post composer default）」與實際 composer default `public` 不符 — composer default 'public' 是 ui-polish-bundle spec 決定的 intentional behavior，不是 walks-auto-photo-share epic 的 regression；spec doc 描述需修

### Edge cases handled

- User skips start photo but takes end photo: independent flows; start's pendingWalkId still used by `createWalk` so end post still cross-links correctly
- User cancels composer (no publish): photo not uploaded to Storage (composer never reaches `createPost`); pendingWalkId still drives the eventual `createWalk` for cross-link
- Walk cancelled (GPS fails): START post already published with walkId pointing at a walk doc that never gets created — acceptable per spec edge case ("walkId reference 還在指向 cancelled walk")
- Concurrent walks (multiple tabs): each tab mints its own walkId; no collision
- Personal-mode user: composer's selectedPets defaults work; post writes with `familyId: null` and renders in own-feed
- Confetti not broken: end prompt z-60 sits above z-40 screen and confetti overlay, sheet itself doesn't unmount the done screen

### 已知 quirks / future spec candidates

- START post's walkId points to a doc that's STILL not committed when published (createWalk fires only on saveWalkOnce at done-screen exit). Feed clients reading `post.walkId` need to tolerate missing referent — already does, since no surface dereferences it yet
- Composer pets list duplicates a query that the walks page already runs — could share via context, but tracking-view's self-contained shape kept simpler
- No "Just sent ✓" toast after auto-photo post publishes; user sees the composer close and trusts the post landed in feed (consistent with freehand composer)
- A2 streak push, leaderboard, B2 family-milestone all unchanged — auto-photo posts ride independently from those signals
- "Save to album" SaveToAlbumButton (separate spec) is already wired into the composer's per-photo preview, so users can also save the auto-photo to Photos before publishing — no extra wiring needed

## User Vision（原話保留）

> 「加入剛開始跟剛結束遛狗的時候拍一張照自動分享到動態的功能」

## 3 個 decisions（confirmed）

| # | Decision | Final | 註 |
|---|---|---|---|
| **D1** ✅ | 觸發方式 | **Prompt「要拍開始/結束照嗎？」可 skip** | 採 PM 推薦 — 避免強制相機跳出嚇到 user |
| **D2** ✅ | 拍完發動態 | **進 composer preview，user 編 caption 才發** | 採 PM 推薦 — 保留 user 控制 + 避免奇怪照片被自動發 |
| **D3** ✅ | 2 張照怎麼包 post | **各自 1 個 post**（開始 1 個 / 結束 1 個）| user 改 PM default — 每張獨立 post 可獨立 caption / reaction |

## 背景 / 現有資產

- walks v2 已有 mid-walk camera capture (walk-tracking-view.tsx 內 camera CTA)
- `post-composer.tsx` 既有 composer，含 photo upload + caption + 發布
- Firebase Storage `walks/{walkId}/{photoId}` upload pattern 已有
- `posts` collection 既有：photoURLs[] + caption + familyId + ownerUid + createdAt
- Settings 目前無「遛狗自動拍照」toggle — 本 spec 加（預設 ON）
- PhotoLightbox spec 同步在進行中（feed post photo 點圖放大）— 本 spec 發的 post 直接享用

## Flow

### A. 開始遛狗 prompt

1. User 在 `/app/walks` 點「開始遛狗」CTA
2. 若 `user.walkPrefs.autoPhotoShare === false` → skip 直接進 tracking（跳到 step 7）
3. Bottom sheet modal 跳出：
   ```
   📸 拍張開始照？
   分享 Mango 出發的瞬間給家人
   [拍照] [跳過]
   ```
4. [跳過] → close sheet → 直接進 tracking（step 7）
5. [拍照] → 開相機（reuse 既有 camera capture in walk-tracking-view 邏輯）
6. 拍完 → 進 post composer preview（複用 post-composer）：
   - Photo 預載
   - Caption 預填「Mango 開始遛狗 🐾」(可編)
   - Privacy 預設 family-only（對齊既有 post composer default）
   - [發布] → 上傳 photo + create post doc with `walkId` → close composer
   - [取消] → discard photo（不上傳 Storage 省 quota）→ close composer
7. Walk tracking 開始（既有 flow，不變）

### B. 結束遛狗 prompt

1. User 在 tracking phase 點「結束遛狗」
2. Walk 完成計算 + Firestore commit walk doc（既有）
3. Done screen render（既有 confetti + emerald celebration）
4. **延遲 1 秒**（避免打斷慶祝 moment）bottom sheet modal 從下方升起：
   ```
   📸 拍張結束照分享給家人？
   Mango 今天走了 {N} 分，留個紀念
   [拍照] [跳過]
   ```
5. [拍照] → 開相機 → 拍 → composer preview → 發布/取消（同 A flow）
   - Caption 預填「Mango 遛完了！走了 {N} 分 ✨」
6. [跳過] 或發布完 → 回 done screen，user 可繼續看 recap / 操作既有 CTA

## 完成標準

### 新元件

- [ ] `src/components/walks/photo-prompt-sheet.tsx`：bottom sheet modal
  - Props: `open: boolean`, `onClose: () => void`, `onTake: () => void`, `petName: string`, `phase: "start" | "end"`, `walkMinutes?: number`
  - Bottom sheet 從下方升起（mango.card-soft bg + border-mango-hairline + rounded-t-3xl）
  - 內含 📸 emoji + 標題 + 副文 + 2 buttons
  - 點背景或 swipe-down 關 → 等同 [跳過]
  - prefers-reduced-motion：snap appear（無 slide-up）

### 改既有檔

- [ ] `src/app/app/walks/page.tsx`：「開始遛狗」CTA onClick handler 加 prompt sheet 流（檢查 settings → show sheet → 拍/跳過分支）
- [ ] `src/components/walks/walk-tracking-view.tsx`：done screen 加 prompt sheet（mount 後 delay 1s 顯示；reuse 同元件 phase="end"）
- [ ] `src/components/feed/post-composer.tsx`：加 3 個 optional props：
  - `initialPhoto?: File | Blob` — 預載照片
  - `initialCaption?: string` — 預填文字
  - `walkId?: string` — 帶入 post.walkId
- [ ] `src/lib/types.ts`：
  - `AppUser.walkPrefs?: { autoPhotoShare?: boolean }`
  - `Post.walkId?: string`
- [ ] `src/lib/firebase/users.ts`：`updateWalkAutoPhotoShare(uid, enabled: boolean)` helper
- [ ] `src/lib/firebase/posts.ts`：`createPost(...)` 支援 optional `walkId` field 寫入
- [ ] `src/app/app/settings/page.tsx`：加「遛狗自動拍照」section（位置：PushToggle / 主動推播 section 下方 / Privacy & Data 上方）
- [ ] 新元件 `src/components/settings/walk-auto-photo-section.tsx`：toggle + 1 行說明

### Schema

- [ ] `AppUser.walkPrefs?: { autoPhotoShare?: boolean }` 新 namespace（為將來其他 walk prefs 預留）
- [ ] `Post.walkId?: string` 新 optional field（reference to walks/{walkId}，未來可 cross-link）
- [ ] `firestore.rules`：
  - user 可改自己的 `walkPrefs`
  - Post.walkId 寫入規則跟 caption 同（owner 可寫）
- [ ] 既有 user 沒 walkPrefs → 視為 `autoPhotoShare: true`（預設 ON）

### i18n

- [ ] `messages/zh-TW.json` + `messages/en.json` 新 keys：
  - `WalksPhotoPrompt.start.title`（「拍張開始照？」/「Take a start photo?」）
  - `WalksPhotoPrompt.start.body`（「分享 {pet} 出發的瞬間給家人」/「Share {pet} setting off」）
  - `WalksPhotoPrompt.end.title`（「拍張結束照分享給家人？」/「Take an end photo?」）
  - `WalksPhotoPrompt.end.body`（「{pet} 今天走了 {min} 分，留個紀念」/「{pet} walked {min} min — make it count」）
  - `WalksPhotoPrompt.take`（「拍照」/「Take photo」）
  - `WalksPhotoPrompt.skip`（「跳過」/「Skip」）
  - `WalksPhotoPrompt.captionStartDefault`（「{pet} 開始遛狗 🐾」/「{pet} starting a walk 🐾」）
  - `WalksPhotoPrompt.captionEndDefault`（「{pet} 遛完了！走了 {min} 分 ✨」/「{pet} done walking! {min} min ✨」）
  - `Settings.walkAutoPhoto.title`（「遛狗自動拍照」/「Auto-photo on walks」）
  - `Settings.walkAutoPhoto.body`（「開始 / 結束遛狗時提示拍照，可一鍵分享到動態」/「Prompt to capture + share at walk start & end」）

### 護欄

- [ ] 不動 walks logic（start/stop/GPS/Wake Lock/photoURLs[] in walk doc）
- [ ] 不動 walk done screen confetti / emerald celebration 結構（新 sheet 是 overlay，z-index 高於 confetti）
- [ ] 不動既有 post-composer 內部結構（只加 optional props 並向後相容）
- [ ] 不動 mango tokens
- [ ] 不引入新 image / sheet / animation library
- [ ] Composer cancel 時 photo 不上傳 Storage（節省 quota）
- [ ] 若 user denied camera permission → prompt 顯示 fallback CTA「從相簿選照片」（reuse 既有 file input pattern）+「跳過」
- [ ] 不動 既有 walk-tracking-view 中段 manual camera capture（user 仍可在 tracking 中手動拍照進 walk.photoURLs[]，跟本 spec auto-post 是不同 surface）

### 預驗收 checklist

- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP iPhone (`/app/walks`)：
  - [ ] 點「開始遛狗」→ 看到 prompt sheet → [跳過] → tracking 直接開始
  - [ ] 點「開始遛狗」→ [拍照] → 相機拍 → composer 預填 photo + caption → [發布] → tracking 開始 + `/app/feed` 看到新 post
  - [ ] tracking 中 → 點「結束遛狗」→ done screen render（confetti 跑）→ 1s 後 prompt sheet 從下升起
  - [ ] [拍照] → composer → [發布] → feed 看到第 2 個 post（與開始照各自獨立）
  - [ ] [跳過] 結束照 → done screen 仍 interactive，confetti 不破
  - [ ] Settings → 遛狗自動拍照 toggle OFF → 下次遛狗無 prompt（兩段都跳過）
  - [ ] Camera permission denied → prompt 退到 fallback「選相簿照片」/「跳過」
- [ ] 雙 post 出現在 feed（start post 時間早於 end post）
- [ ] Post photoURLs[].length === 1（各自 1 張，不合併）
- [ ] Post.walkId 對的 walkId（query 兩 post 都 reference 同 walkId OK）
- [ ] prefers-reduced-motion 用戶：sheet 動畫 snap appear（無 slide-up），confetti 既有行為保留
- [ ] Lighthouse a11y on `/app/walks` 不掉
- [ ] commit message：`feat(walks): auto-photo prompt + share on start/end`

## 不在範圍

- 拍照中 filter / edit / sticker
- Photo with GPS overlay（route map 印在照片上）
- 自動 tag 家人 / friends
- AI 自動寫 caption（user 可手動編）
- **開始 + 結束照合 1 post**（D3 user 選獨立）— 未來想合可加 follow-up spec
- **Auto-post 直接不 preview**（D2 user 要 preview）
- Quiet mode（如半夜遛狗不 prompt）
- Pet recognition（自動確認照片有狗）
- Boomerang / 短影片
- 拍照時加 audio 註解

## Edge cases

| Case | 處理 |
|---|---|
| Camera permission denied | Prompt sheet 加 fallback「從相簿選照片」+「跳過」｜ 用既有 file input pattern |
| Composer 上傳失敗 | 顯示 error + 保留 composer 給 user retry / cancel |
| User 跳過開始照但要拍結束照 | 互相獨立；結束照仍 prompt |
| Settings `autoPhotoShare === false` | 全程不 prompt（兩段都直接 skip）|
| User no pets | 不 prompt（無 caption 對象；fallback "你"，但 walks v2 0 pets 早已導去建寵物 flow，理論上不會走到這）|
| Personal mode user | 仍可拍 + post（post 寫 ownerUid + familyId=null，feed 顯示給自己看）|
| Network 差 photo 上傳慢 | Composer 顯示 spinner；user 可 cancel |
| 結束照 prompt 跟 confetti 同時 | Prompt 延遲 1s 出現，confetti 先跑 |
| User 點開始遛狗 → 拍照 → 取消 composer | Photo discard，walk tracking 仍 start |
| User 拍開始照但 walk 沒完成（GPS 失敗 walk 取消）| Start post 已發；walk doc 取消 — post 保留（walkId reference 還在指向 cancelled walk）；可接受（feed 仍展示「開始遛狗了」這個瞬間）|
| Tracking 中 reload page | 既有行為（不在本 spec）— start post 已發出去不影響 |
| Walk goal 未達 vs 已達 | 結束照 prompt 都 show；caption 預填可帶 minutes 數字反映實際 |
| User 在開始 prompt 點背景關 | 等同 [跳過] |

## 跟其他 spec 的關聯

- **walks-v2-rebuild.md (Phase 1 v2)**：本 spec 在 walks page CTA + walk-tracking-view done screen 加新 UX overlay，不破其他結構
- **photo-lightbox.md**：本 spec 發的 post 在 feed 上直接享用 PhotoLightbox 點圖放大功能 — 兩 spec 正好相補
- **family-leaderboard-realtime.md**：無關聯
- **engagement-push-notifications.md (Epic 5 B2)**：B2 family-milestone push 仍在 walks onCreate trigger（家人達 30 min 推給家人）；本 spec 發 post 也會出現在 feed — 兩 signal 互補（push 是即時通知 / post 是 feed 紀錄）
- **既有 walks photoURLs[] in walk doc**：本 spec 拍的 photo 寫進 post 而非 walk.photoURLs[]（兩件事：walk.photoURLs 是 walk-internal 照片如中段拍；本 spec 是 feed-facing post）

## PM 觀察

工作量 M，但 reuse 既有 post-composer + camera capture 邏輯，新元件僅 photo-prompt-sheet + walk-auto-photo-section。建議 Feature Builder 1-2 個 session 內 ship，拆 commit：

1. `feat(types): walkPrefs.autoPhotoShare + Post.walkId schema + updateWalkAutoPhotoShare helper`
2. `feat(walks): photo-prompt-sheet 元件 + walks page 串開始照流`
3. `feat(walks): walk-tracking-view done screen 串結束照流（1s delay overlay）`
4. `feat(composer): post-composer 加 initialPhoto / initialCaption / walkId props 給 walk-flow 預填`
5. `feat(settings): 遛狗自動拍照 toggle section（預設 ON）`
6. `chore(i18n): WalksPhotoPrompt.* + Settings.walkAutoPhoto.* keys (zh-TW + en)`

部署順序：先 deploy schema + rules（walkPrefs + Post.walkId）→ 再 deploy frontend（settings UI + walks flow）。一個 push 即可（無 functions 改動）。

## Launch prompt（user 開 Feature Builder session copy 用）

```
本 session 固定角色：Feature Builder — 遛狗開始/結束加 photo prompt + 自動發動態。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/walks-auto-photo-share.md（PM 寫好，含 flow A/B + 完成標準 + 護欄 + edge cases + i18n keys）
- 既有 walks page: src/app/app/walks/page.tsx（Phase 1 v2 SHIPPED 視覺）
- 既有 walk-tracking-view: src/components/walks/walk-tracking-view.tsx（done screen confetti + emerald celebration 不動）
- 既有 post-composer: src/components/feed/post-composer.tsx（你加 3 個 optional props 預填）
- 既有 camera capture pattern: walk-tracking-view 內 mid-walk camera CTA 邏輯
- 既有 Storage upload: walks/{walkId}/{photoId} pattern
- mango palette: src/app/globals.css 的 @theme inline
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4

護欄
- 動 src/components/walks/photo-prompt-sheet.tsx（新檔）OK
- 動 src/components/settings/walk-auto-photo-section.tsx（新檔）OK
- 動 src/app/app/walks/page.tsx + src/components/walks/walk-tracking-view.tsx 加新 UX overlay OK，但不重排結構
- 動 src/components/feed/post-composer.tsx 加 3 個 optional props（向後相容）OK
- 動 src/lib/types.ts + src/lib/firebase/users.ts + src/lib/firebase/posts.ts OK
- 動 src/app/app/settings/page.tsx 加 section OK
- 動 firestore.rules（walkPrefs write + Post.walkId）OK
- 動 messages/zh-TW.json + messages/en.json OK
- 不動 walks logic (start/stop/GPS/Wake Lock)
- 不動 done screen confetti / emerald celebration 結構
- 不動 既有 post-composer 內部結構（只加 optional props）
- 不動 mango tokens
- 不引入新 image / sheet / animation library
- Composer cancel 時 photo 不上傳 Storage（節省 quota）

實作順序
1. Schema + helper: types.ts + users.ts + posts.ts + firestore.rules
2. Photo-prompt-sheet 元件（bottom sheet，prefers-reduced-motion snap appear）
3. Walks page 開始 CTA 串 prompt 流
4. walk-tracking-view done screen 串結束 prompt（1s delay）
5. Post-composer 加 initialPhoto / initialCaption / walkId props
6. Settings 遛狗自動拍照 toggle section（預設 ON）
7. i18n keys 補
8. npx tsc --noEmit pass
9. dev server Chrome MCP 跑全 flow A/B + skip + camera denied + settings OFF
10. commit 拆 6 個（或 user 自選合併）
11. push origin main → App Hosting auto-deploy 5-8 min

預驗收（spec 內 checklist 跑完）
- 雙 post 出現在 feed
- Post.walkId 對的 walkId
- Settings toggle OFF 真的 skip
- Camera 拒權 fallback
- reduced-motion snap appear
- Lighthouse a11y 不掉
- npx tsc --noEmit pass

回報格式
- 每 commit hash + 1 行 review note
- 全部 ship 後 summary 給 PM 收尾 roadmap

開工。
```
