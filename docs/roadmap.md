# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-29（🍎 Cross-platform PM — **iOS parity checklist + Web/PWA 並行 policy 落地**：[`ios-parity-checklist.md`](../features/ios-parity-checklist.md)（web 全 20 路由 → P0–P7 對齊;抓出餐廳/知識庫/照片圖庫 3 個 phase plan gap + 5 open questions）+ [`ios-pwa-parallel-policy.md`](../features/ios-pwa-parallel-policy.md)（P0 hard freeze / P1–P7 parallel guarded + catch-up 節奏）｜先前：P0 monorepo migration spec READY-FOR-DEV + npm workspaces + iOS 五角色結構落地）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **Epic 4: 視覺重設計（芒果主題）** — Phase 0/0.5/(原 Phase 1)/(**Phase 1 v2 全頁重建**) ✅ SHIPPED；Phase 2-5 unblocked
  - Phase 1 v2 ship 2026-05-25 ~09:15：6 個新元件 `c98c939` + walks page 全頁重寫 `984be5b` + 9 個 i18n keys `110601e` + SHIPPED 紀錄 `33fef7b`
  - Desktop Chrome MCP 12 項驗收全 ✅；spec **0 deviation**；tracking phase + done screen palette 不破
  - ⚠️ **complete 變體待 user 觸發**：今日走滿 30 min 才能驗 dial 環變綠 + check badge + Confetti decor + 「再遛一次」CTA
  - ⚠️ 其他待驗：mobile 真實 viewport（Chrome MCP 限制）/ streak ≥7 天 leaf gradient variant
  - 👉 **下個動作（user）**：
    - 即時：今日 walk 滿 30 min 觸發 complete 變體驗收（順便 Epic 5 A1/A2 也對齊測）
    - 然後：決定 Phase 2 (pets page) 要不要走 prototype-first 還是 UI/UX 直接動工
- **Epic 5: 主動推播 — 提升用戶活躍** — [`docs/features/engagement-push-notifications.md`](../features/engagement-push-notifications.md) ✅ **5 phase 全 SHIPPED + deploy verified**（FB session 5/24 深夜批 ship + 收尾 report）
  - 4 push types 上線：A1 evening reminder 20:00 cron (`1a6fc7f`) / A2 streak warning 22:00 cron (`64f5de7`) / B1 rank-overtake aggregateLeaderboards 改 (`9c6442e`) / B2 family-milestone walks onCreate (`40a7e02`)；schema + UI (`f1e6952`)；PM ship recap (`380786d`)
  - Deploy 全到位：rules（engagementPushes + userDailyStats）+ 3 個新 functions create + aggregateLeaderboards update + frontend push 完 App Hosting auto-build
  - 1 deviation：`engagementPushes` 路徑改 3-level（`/{type}/waves/{ISO}`，functionally 等價）
  - 安全網：每 push 4 個守門（tokens > 0 / 未 opt-out / 寵物存在 / family > 1 人 for B2）+ token cleanup arrayRemove + audit doc per wave 留 trace
  - 👉 **下個動作（user）**：
    - 即時：手動 test 觀察清單跑一輪（spec 內 4 個 test 步驟）
    - **觀察至 2026-05-27（3 天）**：每 push opt-out 率 < 20% / A1 開啟率 ≥ 20% / A2 補遛率 ≥ 15% / B1 追上率 ≥ 10% / B2 family 開啟率 ≥ 30% / 同晚 A1+A2 雙推不擾人
    - 觀察過關 → 收尾移到已收尾速覽；不過關 → 寫 follow-up（throttle / 文案調整 / 時段微調）
- **Family Leaderboard 即時更新** — [`docs/features/family-leaderboard-realtime.md`](../features/family-leaderboard-realtime.md) ✅ **SHIPPED 2026-05-25**（FB session 3 commits + deploy 完成）
  - `bf8ed08` refactor: extract computeWalkerPeriodScore helper
  - `1245286` feat: recomputeWalkerLeaderboards onCreate trigger + audit + lastUpdatedAt
  - `4edb873` feat: client onSnapshot listener + glow animation + reduced-motion skip
  - Deploy 全到位：rules（realtimeLeaderboardUpdates audit）+ functions:recomputeWalkerLeaderboards,aggregateLeaderboards + App Hosting frontend rebuild
  - ⚠️ Mid-session hygiene：commit `d07511c` 訊息誤掛 `feat(leaderboard)` 但內容是 `/join` redirect 修復（前一 session 遺留 working tree）；歷史 cosmetic 髒，無功能影響
  - 👉 **下個動作（user）**：雙瀏覽器實機 test（家人 A 在 leaderboard / 家人 B 完成 walk → 對方 1-2s glow）+ 明天 00:30 cron reconciliation 觀察
- **Phase 2 pets 全頁重建** — [`docs/features/pets-v2-rebuild.md`](../features/pets-v2-rebuild.md) ✅ **SHIPPED 2026-05-25**（UI/UX session 7 commits + 6 artboard 變體全 port，PM 後 sync header）
  - `cbd95df` pet-avatar + top-bar + header + switcher / `b24c17c` pet-tabs + URL state + stat grid + overview / `fbc4bcf` reminder-card + reminders / `5e14f15` expense-card + donut + expenses / `a40481a` health-record-card + weight-trend chart + health / `46c62e2` floating-add tab-aware / `9d7956a` empty-state + page.tsx 整合
  - Pet avatar 改用真照片 + fallback initial / Donut chart + 體重 trend line chart 純 hand-rolled SVG / FAB tab-aware tone
  - 👉 **下個動作（user）**：實機驗證 — 單 pet / 多 pet switcher / 4 tab (概覽/提醒/開銷/健康) / EmptyState 0 pets 情境
- **Per-pet 自訂散步目標** — [`docs/features/per-pet-walk-goal.md`](../features/per-pet-walk-goal.md) ✅ **SHIPPED 2026-05-25**（FB session 6 commits + A1+B2 deployed asia-east1）
  - `1d0f51b` types + walk-goals helper / `ee9bb1a` updatePet walkGoal passthrough / `8ac764f` pet-walk-goal-input stepper + form 整合 / `9606f80` pet-picker-dropdown + i18n / `313af47` walks page activate chevron + activePet state / `985a547` A1+B2 push cascade (deployed)
  - **Phase 1 v2 DEFERRED chevron 已 ACTIVATED** — multi-pet user 看到 dropdown picker 含 goal chip + 「管理寵物」link
  - A2 streak / leaderboard scoring 全照 spec 不動
  - 已知 follow-ups（PM 排序候選）：per-pet push 不只主寵物 / inline goal-stepper 在 picker / breed-based computed goal / goal 改動 history
  - 👉 **下個動作（user）**：實機驗證（多 pet user 切 pet 看 dial 換 goal；A1 20:00 cron 看 push 用新 threshold）+ live test pending
- **拍照後選擇性存到手機相簿** — [`docs/features/save-photo-to-album.md`](../features/save-photo-to-album.md) ✅ **SHIPPED 2026-05-25**（FB session 6 commits + 4 個拍照 entry 全接 SaveToAlbumButton）
  - `c106d74` save-to-album helper / `ff5e26d` SaveToAlbumButton + i18n / `c6aa3b5` pet-form-dialog / `76f7fbb` walk-tracking-view / `fb0a120` receipt-scanner / `224829d` post-composer per-photo
  - 純 client + browser API（Web Share），無 schema / functions 改動
  - 👉 **下個動作（user）**：iOS Safari/PWA real-device 4 入口 test → share sheet 點「儲存影像」進 Photos.app
- **UI Polish Bundle 2026-05-25** — [`docs/features/ui-polish-bundle-2026-05-25.md`](../features/ui-polish-bundle-2026-05-25.md) ✅ **SHIPPED 2026-05-25**（4 commits + App Hosting auto-build）
  - `76ac18d` friends icon in settings avatar 框 / `d53f65e` post default public / `74751a3` leaderboard refresh + 800ms spinner / `9ab5c10` i18n keys
  - 👉 **下個動作（user）**：實機跑 3 個改動驗收 — settings friends icon 點 / 發 post 看預設 public / leaderboard refresh button 點
- **加入家庭時自動加為家人好友** — [`docs/features/auto-friend-family-members.md`](../features/auto-friend-family-members.md) ✅ **SHIPPED 2026-05-25**（3 commits + 1 sideways slip + asia-east1 deployed）
  - `b9038da` friendship-helpers + createMutualFriendship (idempotent) / `e17acd5` autoFriendFamilyMembers onDocumentWritten trigger + audit / `4962c69` autoFriendEvents rules
  - ⚠️ commit `e17acd5` 訊息誤掛 `purgeMyOrphanWalks` 但實際也含 trigger 內容（FB spec 已 verified by grep）
  - ⭐ 同 commit 順手 ship `purgeMyOrphanWalks` callable（leaderboard data hygiene tool，無獨立 spec — FB session 主動修補）
  - 退家 friendship 仍保留（per D1）；trigger 對 N 人 join + missing profile + 重複 join 都 idempotent
  - 👉 **下個動作（user）**：2 帳號 join 同 family live test → friends 頁互相看到
- **遛狗自動拍照 + 自動發動態** — [`docs/features/walks-auto-photo-share.md`](../features/walks-auto-photo-share.md) ✅ **SHIPPED 2026-05-25**（FB session 6 commits + 無 functions / 無 rules 改動）
  - `5ecbe38` schema (walkPrefs.autoPhotoShare + Post.walkId + mintWalkId helper) / `f0fdd61` PhotoPromptSheet bottom sheet + i18n + slide-up keyframe / `22801f9` PostComposer 加 3 optional props / `9e8f7ae` start-photo flow / `94135f5` end-photo flow (1s delay after confetti) / `a03caf9` settings toggle (default ON)
  - START + END 各自 1 post 含同 walkId cross-link
  - 👉 **下個動作（user）**：iOS PWA real-device 4 flows test（START 拍/跳 + END 拍/跳）+ camera 拒權 fallback + settings OFF → 0 prompts
- **🐛 拍收據 AI 辨識不見了** — [`docs/features/bug-receipt-ai-missing.md`](../features/bug-receipt-ai-missing.md) ✅ **SHIPPED 2026-05-26**（Bug Hunter 走完 4 步 + fix #1 ship `e972cf8`）
  - Root cause = mobile bottom-nav reorg (`e34640a` 2026-05-23) 拿掉「開銷」slot + drawer 搬到 settings 頁右上角 → AI 拍收據 變 4-tap 路徑
  - Bug Hunter 選 fix #1（最小，不破 IA）— PM #2 前提不成立：`ExpensesOverviewSection` 是 dead code（grep 整 codebase 從未 import，只 self-reference）
  - Fix：settings 帳號區下方加 Camera quick-action card → `/app/expenses?action=scan` + useSearchParams ref-guarded useEffect 自動開 ReceiptScanner
  - User 路徑：**4 tap → 2 tap** ✅
  - 2026-05-29 audit sync：`ExpensesOverviewSection` 已刪（`22bee39`），此 bug spec 保留為 stopgap 事故紀錄；long-term 正解已由 expenses-into-pets-page ship
  - 👉 **下個動作（user）**：實機驗證 2-tap path（settings → 拍收據 card → scanner 自動開）
- **/app 首頁 v3 — Feed-first + IG Stories pets bar** — [`docs/features/home-v3-feed-first.md`](../features/home-v3-feed-first.md) ✅ **SHIPPED 2026-05-26**（UI/UX session 6 commits + 1 locale polish）
  - `38d847c` stories bar + your-story/pet-story avatars + `useTodayWalkStatus` / `2428507` top bar + feed header + empty/no-posts states / `e13812a` invite-family card / `fdd567a` page integration + 4 variants / `3063707` i18n / `2d63b98` locale-aware App.name top-bar polish
  - Reuses PostCard / PostComposer / listPets / listFeedPosts / useFamily；stories pet tap remains no-op future hook per spec
  - 👉 **下個動作（user）**：production 實機驗 4 variants（family+posts / 0 pets / personal / no posts）+ 點 user avatar 開 composer + stories ring 狀態
- **開銷完全搬進寵物頁** — [`docs/features/expenses-into-pets-page.md`](../features/expenses-into-pets-page.md) ✅ **SHIPPED 2026-05-26**（Feature Builder 5 commits，無 functions / rules / schema 改動）
  - `16f23d9` pet-expenses-body category filter / `0d672d3` FAB direct-to-camera + ReceiptScanner `initialFile/defaultPetId/onManualEntry` / `261d588` `/app/expenses` redirect / `5726640` remove settings quick-action / `22bee39` drop expenses nav + delete dead overview section
  - 產品決策已落地：開銷 IA 完全折進 pets「開銷」tab；per-pet only；舊 `/app/expenses` redirect 到 `/app/pets`
  - 👉 **下個動作（user）**：iOS PWA 真機驗 FAB → camera → AI scan → save → 該 pet list 更新；manual entry fallback；multi-pet 切換隔離；`/app/expenses` redirect
- **Photo Lightbox** — [`docs/features/photo-lightbox.md`](../features/photo-lightbox.md) ✅ **SHIPPED 2026-05-25**（UI/UX session 5 commits + 自寫 SHIPPED record + Chrome MCP verification）
  - `b1c925e` photo-lightbox 元件（carousel + swipe + 三招關閉 + a11y）/ `bc7b6cf` post-card 接 / `97df9b5` walk-row + walk-tracking-view done screen 接 / `69160c4` i18n keys / `9da6883` UI/UX SHIPPED record
  - 👉 **下個動作（user）**：feed post 點 photo / walks recent 點 photo / done screen 點 photo — 3 處驗收 lightbox 開
- **🧹 Pre-iOS Cleanup（audit 清理）** — [`docs/features/pre-ios-cleanup.md`](../features/pre-ios-cleanup.md) ✅ **RESOLVED 2026-05-29 audit sync**
  - PM + general-purpose agent 逐條驗 15 SHIPPED specs vs git + code
  - 2026-05-29 re-audit：原列 knowledge `[id]` orphan / walks `__pycache__` / expense-summary / expenses-overview-section 都不存在；`expense-summary` 刪除 commit `261d588`、`expenses-overview-section` 刪除 commit `22bee39`
  - 已補 `.gitignore` `__pycache__/`；doc drift headers 已修（walk-core / family-leaderboard / reminders-to-pets-page / visual-redesign-mango / pre-ios-cleanup）
  - 驗證：`npx tsc --noEmit` pass；`npm run build` pass（first sandbox run failed on Google Fonts network, network-enabled retry passed）
  - 👉 **下個動作（user）**：可進 iOS P0 monorepo migration
- **🍎 iOS app 戰略 — React Native + Expo + Feature parity 並行 PWA** — [`docs/features/ios-app-strategy.md`](../features/ios-app-strategy.md) **STRATEGY GO**（user 2026-05-28 4 個 strategic decisions confirmed）
  - **🏁 Web-first PWA Phase 完成** — 15 個 SHIPPED features 全在 production
  - ⚠️ **依賴 pre-ios-cleanup 先完成**（清乾淨再 monorepo migration）
  - 4 decisions：D1 RN cross-platform 重寫 / D2 Apple Dev account 已買 / D3 並行 PWA + iOS / D4 feature parity 一次到位
  - Tech stack PM 預設：Expo Managed + Expo Router + @react-native-firebase + TanStack Query + Zustand + EAS Build + Monorepo (**npm workspaces**)
  - 8 phases × 13 週 (~3 個月) solo 估計：P0 Foundation / P1 Walks / P2 Pets / P3 Home+Feed / P4 Leaderboard+Family / P5 Push+Settings / P6 Social / P7 Polish+App Store submit
  - Monorepo migration P0 first：apps/web (既有 Next.js) + apps/ios (新 Expo) + packages/{shared-types, shared-firebase, shared-business, shared-i18n, shared-tokens}
  - 並行維護策略：每 P-phase iOS 收尾 catch up 期間 web 新 feature
  - 工作量 **XL**，3-5 個月 conservative；solo founder vibe-coding 高度依賴 Cursor / Claude Code 加速
  - **P0 已規格化** → [`ios-p0-monorepo-migration.md`](../features/ios-p0-monorepo-migration.md) READY-FOR-DEV（npm workspaces；apps/web + apps/ios + packages/*；App Hosting rootDir 雙改點；回滾策略；iOS Backend + Feature Builder handoff + 驗收清單）
  - **Parity + 並行 policy 已落地**（Cross-platform PM 2026-05-29）→ [`ios-parity-checklist.md`](../features/ios-parity-checklist.md)（single source of truth：每個 web feature → phase → policy → iOS 狀態）+ [`ios-pwa-parallel-policy.md`](../features/ios-pwa-parallel-policy.md)（freeze / catch-up）
    - ⚠️ **5 個 open questions 待 user 拍板**：Q1 餐廳進不進首版 / Q2 知識庫進不進 / Q3 照片圖庫排 P3 / Q4 iOS 背景 GPS 做不做 / Q5 D4「parity 一次到位」是否收斂為「核心 parity + 餐廳/知識庫 post-launch catch-up」
  - 👉 **下個動作（user）**：
    - Pre-work: 確認 Apple Developer Account 可進 + （P0 spec 已含 Firebase iOS app 註冊指令，交 iOS Backend 執行）
    - **開 iOS Backend session** 執行 P0 Step 1-6（migration 主導，全程在 `ios-p0-monorepo` branch，App Hosting branch build 全綠才 merge）
    - 之後 **開 iOS Feature Builder session** 執行 P0 Step 7（apps/ios Expo scaffold）
    - ⚠️ P0 期間暫停其他 production-code session（README 並行規則：P0 搬路徑會碰 repo shape）
- **照片圖庫 + 照片儲存** — [`docs/features/photo-gallery-downloads.md`](../features/photo-gallery-downloads.md) ✅ **SHIPPED 2026-05-27**（Feature Builder `e76f97c`）
  - 新增 `/app/photos`「我的照片」集中圖庫；聚合自己的 post / walk / pet avatar / existing receiptURL；點圖沿用 PhotoLightbox；支援單張、多張、一鍵儲存尚未下載
  - `src/lib/photo-download.ts` 走 Web Share files 優先、desktop fallback Blob download；`users/{uid}/photoDownloadState/{assetId}` 記錄 downloaded state；nav + settings entry + i18n 已接
  - 👉 **下個動作（user）**：production / iOS PWA 驗單張、多張、一鍵儲存未下載，刷新後 downloaded state 不再計入未下載

## Epic 4: 視覺重設計 — 芒果主題（user 2026-05-24 vision + 20 個答案）

| Phase | 內容 | 工作量 | 狀態 |
|---|---|---|---|
| **0** | Design tokens（globals.css @theme inline mango palette + :root radius/motion vars — Tailwind v4 collapsed from spec's tailwind.config.ts plan）| S | ✅ **SHIPPED** `7baff73` |
| **0.5** | Raised center walks tab + bg-mango-card-soft nav surface | S | ✅ **SHIPPED** `e1a7b60` |
| ~~1~~ | ~~`/app/walks` 套 mockup tone（warm cream bg + brand CTA + leaf success）~~ | S | ⚠️ **SUPERSEDED by Phase 1 v2** — 原 ship `37d1ec4` + `8aebe14` 不 rollback，視覺由 v2 覆蓋 |
| **1 v2** | `/app/walks` **全頁結構重建** — radial dial hero + week strip + 圈內走路狗 + 主寵物 only pill + Confetti @ 達標 + 「再遛一次」CTA | M | ✅ **SHIPPED** 2026-05-25 — 元件 `c98c939` + page `984be5b` + i18n `110601e` + 紀錄 `33fef7b`；desktop 12 項驗收全過；complete 變體待 user 觸發 |
| **2 v2** | `/app/pets` + `/app/pets/[petId]` **全頁重建** — TopBar + PetHeader (真照片) + sticky 4-tab pill + 概覽 2×2 stat grid + Reminder/Expense/Health tab bodies + Expense donut + 體重 trend chart + tab-aware FAB + 完整 EmptyState + multi-pet switcher | L | ✅ **SHIPPED 2026-05-25** — 7 commits `cbd95df` → `9d7956a`（[`pets-v2-rebuild.md`](../features/pets-v2-rebuild.md)）|
| ~~2~~ home page | ~~`/app`~~ 移到 Phase 3 | — | merged into Phase 3 |
| 3 | `/onboarding` + Landing + sign-in | M | 🔓 ready，等 PM spec |
| 4 | `/app/settings` + `/app/leaderboard` | M | 🔓 ready，等 PM spec |
| 5 | Drawer pages: `/app/feed` + `/app/restaurants` (+detail) + `/app/knowledge` (+detail) + `/app/friends` (+/add) + `/app/expenses` | L | 🔓 ready，等 PM spec |
| 6 | Polish — 一致性 audit + loading/error tone + reduced-motion verify | S | 等 Phase 2-5 |

**Spec**: [`docs/features/visual-redesign-mango.md`](../features/visual-redesign-mango.md) + Phase 1 v2 addendum [`walks-v2-rebuild.md`](../features/walks-v2-rebuild.md)

**User 20 個 decisions 重點**：
- 主黃 **#FFCA28**（Material Amber 400，user 自訂；比 PM 預設亮）
- 副綠 **沿用既有 emerald**（user 自訂；不另定 #7DBE5B）
- Accent **桃粉 #FFB3BA**
- 圓角 rounded-2xl + 按鈕 rounded-full
- 動效 medium（CSS keyframes，no library）
- ~~**不做**寵物 wiggling 動效（Q11 user push back）~~ → **retract 2026-05-24 深夜**：1 個圈內限定走路狗 OK（v2 prototype dial 中心 232px 範圍內 — 已 ship 在 `walks-pet-walking.tsx`）
- **跳過 dark mode 第一輪**（Q18 — light first；dark 之後迭代）
- 100% 保留既有功能
- WCAG AA accessibility
- Phase by phase 獨立 ship

## 🎉 已收尾 epic 速覽

| Epic | 期間 | 結算 |
|---|---|---|
| 家庭功能 | 2026-05-22 → 2026-05-23 | 6 ship + 2 cancel + 2 insert = 8/8 |
| 核心體驗 v1（walk-core）| 2026-05-23 → 2026-05-24 | 1/1 ship + Screen Wake Lock fix |
| 上架收尾 + backlog P2 | 2026-05-23 | 5/5 ship |
| 核心體驗 v2（user 2026-05-24 vision） | 2026-05-24 | 🎉 6/6 全 SHIPPED |

**累計**：4 epic / ~19 work items / ~50 commits / 3 天（Epic 5 + Phase 1 v2 收尾後再加總；目前 +6 commits Epic 5 + +4 commits Phase 1 v2 + ~5 commits PM bookkeeping = ~15 commits 待累計）

## 下個方向候選（Epic 4 視覺重設計 收完後）

### Option A: PRD §6 上架條件剩下（PM 主推 — 上架前最後一哩）

- 隱私 / 服務條款內容審查（PM 寫內容）
- 自訂網域 + DNS（要花錢買網域）
- App Check 防 API key 盜用
- Lighthouse audit > 90（Epic 4 Phase 6 已 cover Lighthouse Visual / A11y > 90，Perf 可能要另 audit）

### Option B: Dark mode follow-up

Epic 4 跳過了 dark mode 第一輪。Visual redesign 完 + user 用 1-2 週後評估：
- 需要 dark mode → 寫 follow-up spec
- 不需要 → 標 do-not-do（簡化維護）

### Option C: walks 延伸 follow-ups

- 追蹤中 reload 恢復 tracking state
- 獨立 walks history page（非必要；2026-05-28 已先把「全部」改成當頁互動展開完整列表）
- Family mode 加總 walk 進度
- ~~遛狗推播提醒「今天還沒遛」~~（Epic 5 A1 已 ship）

### Option D: 新方向

- 餐廳 Google Places 整合
- 知識庫持續產出
- Analytics / 北極星指標接線

## 想做但還沒規格

- Quiet hours / per-pet opt-out push 設定（Epic 5 follow-up，pushPrefs namespace 已預埋）
- ~~多 pet picker UX~~（per-pet-walk-goal spec 即將解鎖）
- **breed/age/weight 自動計算 walk goal**（per-pet-walk-goal spec ship 後 follow-up，schema source: 'computed' 已預埋）
- **餐廳照片 lightbox**（Photo Lightbox ship 後接 restaurants page，sharing same 元件）
- Push throttle（A1 + A2 同晚雙推觀察後決定）
- 獨立 walks history page（若未來需要搜尋/篩選/分頁再開；目前「全部」已可展開完整列表）
- Dark mode follow-up（Epic 4 後評估）
- 餐廳 Google Places 整合
- 知識庫持續產出
- Analytics / 北極星指標接線
- 自訂網域 + DNS（要花錢）
- App Check 防 API key 盜用
- Lighthouse Perf audit
- 隱私 / 服務條款內容審查
- 追蹤中 reload 恢復 tracking state
- 歷史紀錄搜尋 / 篩選 / 分頁（當資料量大到當頁展開不夠用時再做）
- Family mode 加總 walk 進度
- Orphan walk photos GC
- 照片圖庫批次 ZIP 下載（v1 後看使用量）

## 不做（拒絕清單）

- Web 內背景 GPS 解決方案
- AI 寵物顧問聊天
- 私訊系統
- 訂閱付費 / 廣告（DAU 上百之前不討論）
- 強迫所有使用者必須建立家庭才能使用主功能（2026-05-23 否決）
- 加入家庭時自動 pet merge wizard（2026-05-23 拿掉）— 「不直觀」
- 刪帳號時 anonymize 共用資料（2026-05-23 改 full hard delete cascade）
- 同 family 內同名 pet 合併 / dedupe migration（2026-05-23 取消）
- 開銷 payer 分析卡（2026-05-23 取消）
- walk-core 內把分數作為核心目標（2026-05-23 拿掉）
- walk-core 內把公里數當主要進度條目標（2026-05-23 拿掉）
- walks-v2 內加影片錄製 / 即時定位分享 / 路徑回放 / 天氣 API 整合 / 季節主題 / 競爭性元素（2026-05-24 排除）
- walks-v2 內加自訂鼓勵文案（2026-05-24 — over-engineering）
- 開始遛狗按鈕真的移到下方（沒上方 hero CTA）（2026-05-24 PM push-back，user 選解 A）
- 首頁 feed 只顯示家庭內 posts（2026-05-24 IA reorg D2 預設）
- /app/feed 或 /app/expenses 整頁刪除（2026-05-24 user 確認 D4/D5 都保留）
- ~~**Visual redesign 內加寵物 wiggling / wagging 動效**（2026-05-24 Q11 user 拿掉）~~ → **retract 2026-05-24 深夜**：v2 prototype 採用圈內限定走路動畫（dial 中心 232px 範圍內 6 個 keyframes），user OK；整頁 wiggle 仍 not-do，但限定區域 walking dog 解禁（已 ship 在 `walks-pet-walking.tsx`）
- **Visual redesign 內做 dark mode 第一輪**（2026-05-24 Q18 user 延後）
- **Visual redesign 內加 mascot 芒果角色 / page transition / Material ripple / Google Font / animation library**（2026-05-24 Q9/12/13/15 排除）
- 照片圖庫 v1 自動無提示寫入 iOS Photos / Android MediaStore（Web/PWA 不允許；只能由 user 透過 share sheet 或 browser download 明確儲存）

## 北極星指標

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率
- 每日遛狗完成率（達標 30 分鐘 user / 活躍 user）
- walks doc 內 `photoURLs.length > 0` 的比例（walks-v2 ship 後）

> 還沒接 analytics — 目前只能定性觀察。
