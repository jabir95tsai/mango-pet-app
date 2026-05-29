# iOS App 策略 — React Native + Expo + Feature Parity 並行 PWA

狀態：**STRATEGY GO**（user 2026-05-28 4 個 strategic decisions confirmed）
建立日期：2026-05-28
最後更新：2026-05-28
規格作者：PM session @ `f5c1732`
角色：**iOS Builder**（新 role — RN + Expo 整 stack；solo founder 自己跑 OR 開新 session）
工作量：**XL** — 3 個月（13 週）solo 估計；可能 5 個月 conservative

## User Vision

> 「我們接著要轉向 iOS app 開發了，擬定詳細計畫」

## 4 個 strategic decisions（confirmed）

| # | Decision | Final | 含意 |
|---|---|---|---|
| **D1** | iOS app 採哪條路 | **React Native (cross-platform 重寫)** | Component 邏輯重寫（無法 reuse Next.js routes / DOM 元件），原生 UI 手感，未來可延伸 Android 0 成本 |
| **D2** | Apple Developer Account | 已買 / 隨時可付 $99 | TestFlight + App Store 都能上 |
| **D3** | PWA 命運 | **並行維護**（PWA + iOS 都推） | 雙 codebase 同步 ship feature，需建工作流；不能讓 PWA stale |
| **D4** | First iOS ship scope | **Feature parity 一次到位** | 14+ SHIPPED features 全 port；不接受 MVP slice |

## ⚠️ Reality check（PM 直白）

這組合 = **最高 ambition + 最大 scope**：

- React Native 重寫 ≠ Capacitor wrap — **codebase 邏輯要重寫**，只 backend + schema + types + business logic helpers 可 reuse
- Feature parity (14+ features) = 不能挑著做，每個 feature 都要在 iOS 重建 UI + 接 backend
- 並行 PWA = web ship feature 後 iOS 要 catch up，**雙 maintenance overhead**
- Solo founder vibe-coding = 沒 dev team 分擔，需要靠 Cursor / Claude Code 高度自動化

**保守估計 3-5 個月**才 ship 第一版上 App Store。期間 PWA 仍持續 ship features → iOS 持續 catch up。

PM 不建議改 decisions（user 已 explicit），但會在 plan 內標注 risk + mitigation。

## 🛠 Tech stack（PM 預設，user 可 push back）

| 類別 | 選擇 | 理由 / 替代 |
|---|---|---|
| **RN flavor** | **Expo Managed** | Solo founder 必用 — managed build + OTA updates + EAS Submit；可 eject 到 bare RN if 需要 native module；替代 = Bare RN (full control 但工作量 ×2) |
| **Routing** | **Expo Router** | File-based routing 跟 Next.js App Router heritage 接近；replace React Navigation manual setup；少 setup 時間 |
| **Firebase SDK** | **`@react-native-firebase/*`** native modules | 原生 APNs push（vs FCM web 在 iOS 不完整）+ background FCM + native auth；替代 = Firebase JS SDK (bundle 大 / push 殘廢) |
| **State** | **TanStack Query (server state) + Zustand (client state)** | 跟 Web app 同心智模型；輕量；替代 = Redux (重) / Context only (不夠) |
| **Build / Deploy** | **EAS Build + EAS Submit** | Expo 官方雲端 build（不用 macOS local Xcode build）+ 自動 submit TestFlight；solo founder 不維護 CI/CD |
| **Code sharing** | **Monorepo** (pnpm workspace) | `packages/shared` 含 types + schema + business logic helpers (`walk-goals.ts` 等)；web + ios import 同 package；替代 = git submodule (麻煩) / 兩 repo copy-paste (絕對不行) |
| **UI library** | **None — 自寫 mango palette components** | 已 ship 的 web mango design tokens 直接搬 (radius / spacing / colors)；不用 NativeBase / NativeWind 第三方避免限制；可考慮 NativeWind (Tailwind for RN) 若 user 想保留 Tailwind 寫法 |
| **Image / Photo** | `expo-image-picker` + `expo-camera` | 既有 PWA web file input → RN 對應 native module |
| **Maps / GPS** | `expo-location` + `react-native-maps` | 既有 PWA Geolocation API → native CoreLocation |
| **Push** | `@react-native-firebase/messaging` + `expo-notifications` | 既有 FCM functions backend 不變；iOS APNs token 由 native module handle |
| **Storage** | `@react-native-firebase/storage` | 同 web Storage SDK，photo upload 一致 |
| **Test** | Jest + RN Testing Library + Maestro (E2E) | Maestro 最簡單 E2E for RN |

## 🗂 Monorepo 結構（PM 提議）

```
mango_pet_app/                  ← 既有 web repo 升級為 monorepo
├── apps/
│   ├── web/                   ← 既有 Next.js app (現有 src/ 搬進來)
│   └── ios/                   ← 新 Expo React Native app
├── packages/
│   ├── shared-types/          ← 從 src/lib/types.ts 抽出
│   ├── shared-firebase/       ← Firebase config + auth helpers (platform-agnostic part)
│   ├── shared-business/       ← walk-goals.ts / save-photo helper / pure logic
│   ├── shared-i18n/           ← messages/zh-TW.json + en.json
│   └── shared-tokens/         ← mango palette + spacing + radii (export 為 web Tailwind config + ios theme.ts 兩 format)
├── functions/                 ← Firebase Cloud Functions (不動)
├── firestore.rules / indexes  ← 不動
└── docs/                      ← 不動 (PM spec)
```

**重要**：monorepo migration 是 **P0 第一步**，要小心不破現有 Web ship pipeline (App Hosting build path)。建議用 **pnpm workspace** + 維持 `apps/web` 為 default working dir，App Hosting build script 改指 `apps/web`。

## 📅 Phase breakdown（13 週估計，敏捷可調）

### P0 — Foundation (2 週)

- [ ] Monorepo migration (pnpm workspace + apps/web + apps/ios + packages/*)
- [ ] App Hosting build pipeline 改指 apps/web — 確保 web ship 不破
- [ ] Expo init in apps/ios (Expo Managed + Expo Router)
- [ ] Firebase init in apps/ios (@react-native-firebase + same project config)
- [ ] Auth flow (sign-in with Google / Apple — Apple Sign-In iOS 必須)
- [ ] BottomNav skeleton (5 tabs + raised disc)
- [ ] Mango palette tokens shared
- [ ] EAS Build setup + first build to simulator
- [ ] **Milestone**: Expo build 跑起來 + login + 看到空白 bottom nav

### P1 — Walks (2 週)

- [ ] WalksHomeScreen with dial + week strip + 卡通走路狗
- [ ] PetPickerDropdown (sourced from per-pet-walk-goal SHIPPED)
- [ ] Start walk → GPS tracking (expo-location)
- [ ] WalkTrackingScreen (timer + GPS + stop button)
- [ ] DoneScreen + confetti + emerald celebration
- [ ] Manual walk dialog
- [ ] Walk photo capture (expo-camera) + Storage upload
- [ ] Walks history list (recent walks)
- [ ] Auto-photo prompt sheets (start + end)
- [ ] **Milestone**: 完整遛狗 flow work on iOS simulator

### P2 — Pets (2 週)

- [ ] PetsHomeScreen (list view + switcher dropdown)
- [ ] PetHeader (avatar real photo + fallback initial)
- [ ] PetTabs sticky 4-tab
- [ ] OverviewTab (stat grid + reminders strip + expenses strip)
- [ ] RemindersTab (list + form dialog)
- [ ] ExpensesTab (donut + filters + list + FAB camera)
- [ ] HealthTab (weight trend chart + records)
- [ ] FloatingAdd tab-aware
- [ ] Pet edit form (含 walkGoal stepper)
- [ ] AI receipt scan (camera → extractReceipt callable)
- [ ] EmptyState 0 pets
- [ ] **Milestone**: pets page 跟 web 完全對等

### P3 — Home + Feed (2 週)

- [ ] HomeScreen v3 (Feed-first + IG Stories bar)
- [ ] StoriesBar with walk status rings
- [ ] PostCard list + 10 posts mixed
- [ ] PostComposer dialog
- [ ] InviteFamilyCard for personal mode
- [ ] EmptyStateHome
- [ ] /app/feed full timeline page
- [ ] PhotoLightbox (carousel + swipe + 三招關閉)
- [ ] SaveToAlbumButton (iOS native share API)
- [ ] **Milestone**: feed + posts 全 work

### P4 — Leaderboard + Family (1 週)

- [ ] LeaderboardScreen (family aware + glow on update)
- [ ] FamilySection in Settings (member list + invite + leave)
- [ ] Family invite QR + share link
- [ ] Auto-friend on family join (既有 trigger 已 ship — iOS 只需呈現)
- [ ] **Milestone**: leaderboard 即時更新 + family CRUD

### P5 — Push + Settings (1 週)

- [ ] FCM token 註冊 + APNs setup
- [ ] PushToggle global
- [ ] Engagement push toggles (A1/A2/B1/B2)
- [ ] WalkAutoPhotoSection toggle
- [ ] DeleteAccount flow
- [ ] DataExport
- [ ] FriendsLink (settings avatar 框右側)
- [ ] **Milestone**: 4 個 Epic 5 push 在 iOS 收得到

### P6 — Social (1 週)

- [ ] FriendsScreen list + search
- [ ] FriendRequest send / accept
- [ ] My QR dialog
- [ ] **Milestone**: friends + family system 完整

### P7 — Polish + App Store submit (2 週)

- [ ] App icon (Mango logo + 多 size)
- [ ] Splash screen
- [ ] App Store screenshots (iPhone 14 Pro Max + iPad 12.9")
- [ ] App Store metadata (描述 / 關鍵字 / 隱私 / 服務條款)
- [ ] TestFlight build
- [ ] User + 家人 TestFlight beta test 1 週
- [ ] App Store review submit
- [ ] **Milestone**: 上線 App Store 🎉

**累計**: 13 週 ≈ 3 個月。Realistic 18-20 週（含 buffer）。

## 🔄 並行 PWA 維護策略 (D3)

PWA 持續 ship feature 期間，iOS 怎麼 catch up：

| Web ship 新 feature → iOS port 時機 | 機制 |
|---|---|
| **每完成 1 個 P-phase iOS** | review 期間 web 新加的 feature，下個 phase 內 catch up |
| **緊急 critical feature** | iOS 插隊 port 在 current phase 內 |
| **小 polish (typo / icon)** | iOS 統一在 P7 polish phase 一次 catch up |
| **Backend / schema 改動** | 同 PR 改 packages/shared-types — web + ios 同時 affected (檢測 type error) |

**PM 預設**：本 spec 鎖 13 週 phase plan 為「對齊 web `f5c1732` 的 snapshot」；web 期間繼續 ship 的 feature **暫不 block iOS plan**，iOS ship 後另開 sync sprint catch up。

## 🎯 Code sharing strategy（monorepo packages 細節）

### `packages/shared-types`
- 從 `src/lib/types.ts` 完整搬出
- 雙 app import: web `import { Pet } from '@mango/shared-types'`, ios 同
- TypeScript strict mode 共用

### `packages/shared-firebase`
- Firebase config (apiKey / projectId etc.) — 同 web `src/lib/firebase/init.ts` 拆出 platform-agnostic part
- Auth helpers 共用（callable function wrappers）
- Firestore helper functions (queries) 共用

### `packages/shared-business`
- `walk-goals.ts` (getPetWalkGoalMinutes / DEFAULT_WALK_GOAL_MINUTES / clamp) 100% reuse
- save-photo helper（iOS 用 RN Share API 取代 web Web Share — 抽 interface 共用）
- Pure logic helpers (streak 計算 / 月比較 % 算法 / etc.)

### `packages/shared-i18n`
- `messages/zh-TW.json` + `messages/en.json` 共用 — web next-intl + ios react-i18next 都讀同 json

### `packages/shared-tokens`
- mango palette 從 `globals.css @theme inline` 抽出 .ts file
- Export 為兩 format:
  - web: Tailwind config extend
  - ios: theme.ts object 給 RN StyleSheet

## ⚠️ Risks + mitigations

| Risk | Mitigation |
|---|---|
| RN learning curve solo founder | P0 留 2 週充分時間；用 Expo Tutorial + Claude Code session 加速 |
| Monorepo migration 破 web build | P0 第一步先做；先在 branch 測 App Hosting build 全綠才 merge main |
| @react-native-firebase 跟 Firebase JS SDK 有 API 差異 | 在 shared-firebase 抽 platform-agnostic interface；各自實作 |
| iOS APNs token vs Web FCM token | 兩 token 都寫進 user.fcmTokens（既有 array 結構支援），functions 端不變 |
| Native module compatibility issues (HEIC / Live Photos / etc.) | 接受 limitation；iOS only feature 不在 13 週內做 |
| App Store review rejection | TestFlight 1 週 beta 找 bug；review guideline 預讀；常見拒絕原因（隱私 / 加密 / metadata）pre-check |
| Solo founder pace slip | Phase plan 預留 30% buffer；緊急時退到 MVP slice (walks + pets only) |
| Web shipped 新 feature 期間 iOS 沒有 = user 抱怨 | 並行公告「iOS 仍在 build 中，新功能 next sprint 跟上」+ TestFlight beta 標 alpha 期 |
| Apple Sign-In 強制要求（如有 Google Sign-In iOS 必須 also offer Apple）| 既有 Google Sign-In → iOS 加 Apple Sign-In（Apple guideline 強制）；solo 預估 0.5 週 |
| Photo upload performance 在 RN 慢 | 用 expo-image-manipulator compress before upload；APNs payload 小（既有 functions 已 cover）|

## ✅ Pre-work (user 要做的)

P0 開始前：

- [ ] 確認 Apple Developer Account 帳號可進 (App Store Connect)
- [ ] 確認 Firebase project (web 用的 mango-pet-app) iOS 啟用 — Firebase Console → Settings → Apps → Add iOS app (bundle ID `com.mangopet.app` 或 user 選)
- [ ] 下載 `GoogleService-Info.plist`（iOS Firebase config）
- [ ] 預備 App Store metadata:
  - App icon (1024×1024 master，PM 建議找設計師 OR 用 mango brand emoji 🥭 + 設計工具)
  - 中英 App 描述 (300 字)
  - 隱私 policy / 服務條款（既有 web 文檔可重用）
  - Screenshots（先用 iOS simulator 截）

## 🤖 開新 session 建議

PM 建議開 **新固定 role: iOS Builder** session（區隔 web Feature Builder）：

- 該 session focus 在 apps/ios/ 內 work
- 沿用同一個 monorepo + git repo
- Per-phase ship + commit + PR
- 跟 web Feature Builder 不衝突（兩 apps 並行）

## Launch prompt（user 開 iOS Builder session copy 用）

```
本 session 固定角色：iOS Builder — 用 React Native + Expo 跨平台重寫 Mango Pet 為 iOS app，
feature parity with web PWA，並行維護 web。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app (即將 migrate to monorepo)

⚠️ 必讀
- Spec: docs/features/ios-app-strategy.md（PM 寫好，含 4 strategic decisions + tech stack + 8 phase plan + risks）
- 既有 web app: src/ (含 14+ SHIPPED features)；目標把這些 features 100% port 到 RN
- 既有 Firebase backend: functions/src/index.ts + firestore.rules — 100% reuse (iOS 接同 backend)
- 既有 schema: src/lib/types.ts — 即將抽到 packages/shared-types
- 既有 design tokens: src/app/globals.css mango palette — 即將抽到 packages/shared-tokens
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4 (web side 不能破)

護欄
- 動 apps/ios/* (新檔)、packages/* (新檔) OK
- 動 pnpm-workspace.yaml + 根 package.json OK
- 動 apphosting.yaml build script 指 apps/web OK（App Hosting build pipeline 不能破）
- 不動 functions/src/* (backend 共用)
- 不動 firestore.rules / indexes (共用)
- 不動 既有 src/* until monorepo migration complete (P0 step 1 才搬到 apps/web/)
- 不引入新 Firebase project (用既有 mango-pet-app)

P0 第一週優先順序
1. pnpm workspace init + monorepo 結構
2. 把 src/ 搬到 apps/web/src/ + 確認 npm run dev 仍 work
3. App Hosting build pipeline 改指 apps/web/ + push branch + verify build 全綠
4. Expo init in apps/ios + Expo Router setup
5. Firebase iOS app 在 Firebase Console 加 + 下載 GoogleService-Info.plist
6. @react-native-firebase 安裝 + auth + firestore + storage + messaging
7. BottomNav 5-tab skeleton + Mango palette tokens 共用

每 P-phase 完成必做
- Real iOS simulator 跑全 flow 過
- Type check (tsc --noEmit)
- Commit + push (per phase 1 PR)
- PM 收尾 roadmap

回報格式
- Per phase milestone hash + 1 段 review note
- Per week sprint update (進度 / blockers / 需要 PM 決策)

開工。
```

## 跟其他 spec 的關聯

- **All 14+ SHIPPED web specs**：本 spec 要 iOS port 每一個（walks v2 / pets v2 / home v3 / leaderboard / 4 push types / family / auto-friend / save-photo / photo-lightbox / per-pet-walk-goal / walks-auto-photo-share / expenses-into-pets / UI polish / etc.）
- **visual-redesign-mango.md (Epic 4 partial)**：Phase 0-3 已 ship，Phase 4-6 暫停 — 因 iOS pivot 改變 priority；iOS plan 內 phase 對齊 web 已 ship 的 feature surface
- **既有 backend (functions / rules / indexes)**：100% reuse，不動

## PM 觀察

**這是 Mango Pet 最大 scope 的 epic** — 從 Web-first PWA 戰略轉到 cross-platform native。
- 工作量 ≈ 13 週 / 3 個月 solo founder
- 並行 web maintenance overhead 不小
- Apple ecosystem learning curve 對 vibe-coding founder 是新挑戰

**建議 user 心態**: 慢慢來 + 不要急 + 每週 PM session retro。出狀況可退 MVP slice。3 個月後上 App Store 是 ambitious 但可達。

**1 個 RED FLAG**: 並行 PWA 持續 ship features 期間 iOS 永遠 catch up — risk 是 iOS ship 上 App Store 時已落後 web 1-2 個月。Mitigation: 明確的「iOS catch-up sprint」週期 + user 可選暫緩 web 新 feature 集中精力 ship iOS。

開工前 user 跟 PM session 確認 decisions（spec 內 PM defaults 有沒有要 push back 的）。
