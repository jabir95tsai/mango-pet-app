# iOS P0 — Monorepo Migration Spec（npm workspaces）

狀態：**READY-FOR-DEV**（iOS PM session 2026-05-29 grounded audit + user 確認 package manager = npm workspaces）
建立日期：2026-05-29
規格作者：iOS PM session
角色執行：**iOS Backend**（migration 主導）+ **iOS Feature Builder**（apps/ios scaffold）
工作量：**M**（migration 本身 1-2 天 focused，含 App Hosting branch 驗證）
前置依賴：✅ `pre-ios-cleanup.md` RESOLVED（2026-05-29）

> 這是 [`ios-app-strategy.md`](./ios-app-strategy.md) P0 Foundation 的可執行細化版。strategy spec 原 tech-stack 寫 pnpm workspace；**user 2026-05-29 確認改用 npm workspaces**（理由：沿用既有 `package-lock.json`，App Hosting build pipeline 改動最小，build-break 風險最低）。本 spec 為準。

## 為什麼 npm workspaces（decision rationale）

| 維度 | npm workspaces（選） | pnpm workspace（strategy 原案） |
|---|---|---|
| App Hosting build 風險 | 低 — 不換 lockfile，只改 rootDir | 中 — 換 package manager，App Hosting 要重新確認 pnpm build |
| 既有 pipeline 改動 | 最小 | 較大 |
| 磁碟 / hoisting | 可接受 | 較優 |
| solo founder 心智負擔 | 低（已熟 npm） | 需學 pnpm workspace 規則 |

結論：**App Hosting build 穩定性 > 磁碟效率**。P0 先求不破 web ship pipeline。

## 🎯 P0 完成定義（Milestone）

1. Repo 變成 npm workspaces monorepo：`apps/web`（既有 Next.js）+ `apps/ios`（Expo scaffold）+ `packages/*`。
2. **Web ship pipeline 不破**：push main → App Hosting auto-build 綠 → production 正常。
3. `apps/ios` Expo Managed + Expo Router 跑得起來，simulator 看到空白 bottom nav + login。
4. `packages/shared-types` 至少抽出一個真實 type 被 web + ios 雙邊 import 成功（證明 code sharing 機制通）。
5. 所有改動可一鍵 rollback（見回滾策略）。

> P0 **不做** feature parity（那是 P1+）。P0 只證明「monorepo 結構成立 + web 沒破 + ios 跑得起來 + 共享機制通」。

---

## 📐 目標結構

```
mango_pet_app/                    ← npm workspaces root
├── package.json                  ← workspace root（"workspaces": ["apps/*","packages/*"]）
├── package-lock.json             ← 單一 lockfile（workspace root）
├── apps/
│   ├── web/                      ← 既有 Next.js（src/ + public/ + 設定檔搬進來）
│   │   ├── package.json          ← web app 專屬 deps + scripts
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── postcss.config.*
│   │   ├── eslint.config.*
│   │   ├── apphosting.yaml        ← 跟著 web 搬
│   │   ├── scripts/generate-fcm-sw.mjs
│   │   ├── .env.local             ← 跟著 web 搬（git-ignored）
│   │   ├── src/
│   │   └── public/
│   └── ios/                      ← 新 Expo app（iOS Feature Builder scaffold）
├── packages/
│   ├── shared-types/             ← P0 先抽 1 個 type 證明機制；其餘 P1+ 漸進
│   ├── shared-tokens/            ← P0 stub（mango palette）；填充 P1+
│   └── （shared-firebase / shared-business / shared-i18n P1+ 再建）
├── functions/                    ← ⚠️ 留在 root（firebase.json source:"functions" 指向）
├── firestore.rules               ← ⚠️ 留在 root（firebase.json 指向）
├── firestore.indexes.json        ← ⚠️ 留在 root
├── storage.rules                 ← ⚠️ 留在 root
├── firebase.json                 ← root（apphosting.rootDir 改指 apps/web）
├── .firebaserc                   ← root（不動，default = mango-pet-app）
└── docs/                         ← 不動
```

### ⚠️ 留在 root、絕對不要搬進 apps/web 的東西

`firebase.json` 用相對路徑綁這些；搬了會破 functions / rules / indexes deploy：

- `functions/`（`source: "functions"`）
- `firestore.rules` / `firestore.indexes.json` / `storage.rules`
- `firebase.json` / `.firebaserc`

P0 **完全不動** backend（functions / rules / indexes / storage）。iOS 接同一個 `mango-pet-app` project、同一份 schema。

---

## 🔧 App Hosting：最大 break 風險（必讀）

目前綁定（已實查）：
- `firebase.json` → `"apphosting": { "backendId": "mango-pet", "rootDir": "/" }`
- 既有 backend 從 GitHub auto-build，root 為 repo 根目錄。

migration 後 web 在 `apps/web`，要兩處對齊：

1. **`firebase.json`** → `apphosting.rootDir` 由 `"/"` 改成 `"apps/web"`（給 `firebase deploy` 用）。
2. **Firebase Console → App Hosting → backend `mango-pet` → Settings → Root directory**：GitHub auto-build 用的是 **console 端的 root directory 設定**，不是 firebase.json。這格要改成 `/apps/web`。**這是最容易漏、最容易讓 production build 紅掉的一步。** → 列入 iOS Backend handoff + pre-work。

3. **npm workspaces + App Hosting install 行為需 branch 實測**：workspaces 的 hoisting 讓 `npm ci` 要在 workspace root 跑，App Hosting 從 subdir build 時的 install 行為要在 branch 上驗證一次再 merge。**這是 P0 的硬性 gate。**

---

## 🧩 Path-sensitive 點（migration 時要逐一確認）

實查既有設定，搬 `apps/web` 後這些相對路徑的 base 會跟著 `next.config.ts` 的 cwd 走，理論上不破，但要逐項驗：

| 項目 | 既有值 | 搬後行為 | 風險 |
|---|---|---|---|
| next-intl plugin | `createNextIntlPlugin("./src/i18n/request.ts")` | 相對 next.config.ts → `apps/web/src/i18n/request.ts` ✅ | 低 |
| Serwist swSrc/swDest | `src/app/sw.ts` → `public/sw.js` | 相對 build cwd（apps/web）✅ | 低 |
| generate-fcm-sw.mjs | `join(__dirname, "..")` 當 root | scripts 搬到 `apps/web/scripts/` → root=apps/web，寫 `apps/web/public/` ✅ | 低（前提：scripts 跟著搬） |
| `predev`/`prebuild` hooks | 在 web package.json | 留在 `apps/web/package.json` ✅ | 低 |
| Next images remotePatterns | next.config.ts 內 | 跟著搬 ✅ | 無 |
| `.env.local` | repo root | 搬到 `apps/web/.env.local`（git-ignored，user 手動移動本地檔） | 中（漏移 → 本地 push token 空） |

---

## 🪜 Migration 執行順序（iOS Backend 主導）

> **全程在 branch 上做**（例如 `ios-p0-monorepo`），main 保持可隨時 rollback。

### Step 1 — 開 branch + git mv 保留歷史
- `git checkout -b ios-p0-monorepo`
- 用 `git mv` 搬（保留 blame）：`src/`、`public/`、`next.config.ts`、`tsconfig.json`、`postcss.config.*`、`eslint.config.*`、`apphosting.yaml`、`scripts/`、`next-env.d.ts` 等 web-only 檔 → `apps/web/`
- `.env.local` 由 **user 手動**移到 `apps/web/`（git-ignored，agent 看不到）

### Step 2 — 切 package.json
- Root `package.json`：改成 workspace root（`"private": true`、`"workspaces": ["apps/*","packages/*"]`、移除 web 專屬 deps/scripts，保留 repo-level 工具若有）
- `apps/web/package.json`：承接原 web `dependencies` / `devDependencies` / `scripts`（dev/build/start/lint/typecheck/generate-sw + predev/prebuild）
- 重跑 `npm install` 在 root → 產生單一 workspace `package-lock.json`

### Step 3 — firebase.json + Console root
- `firebase.json` → `apphosting.rootDir: "apps/web"`；`apphosting.ignore` 視情況調整
- ⚠️ **user / iOS Backend**：到 Console 改 backend `mango-pet` 的 Root directory = `/apps/web`（auto-build 用）

### Step 4 — 本地驗證 web
- `npm run -w apps/web typecheck`（= `tsc --noEmit`）pass
- `npm run -w apps/web build` pass（Google Fonts 需網路；sandbox 失敗時用 network-enabled retry，比照 pre-ios-cleanup）

### Step 5 — App Hosting branch 驗證（硬性 gate）
- push branch，讓 App Hosting 對該 branch 跑一次 build（或臨時把 backend 指 branch / 用 preview channel）
- **build 全綠 + preview 正常**才可 merge main。紅 → 回 Step 2/3 修，不 merge。

### Step 6 — packages 機制驗證（最小）
- 建 `packages/shared-types`（先抽 1 個 type，如 `Pet`，從 `apps/web/src/lib/types.ts` re-export 或搬出）
- `apps/web` 改 1 處 import 用 `@mango/shared-types`，typecheck pass → 證明 web 端共享通
- `packages/shared-tokens` 先放 stub（mango palette object），P1+ 再填

### Step 7 — apps/ios scaffold（iOS Feature Builder）
- 見下方 handoff

### Step 8 — merge + production smoke
- merge main → App Hosting auto-build → 等 5-8 分鐘 → Chrome MCP 驗 production（login / walks / pets 任一 golden path）

---

## ↩️ Web/PWA Build 回滾策略（D3 並行維護的安全網）

P0 期間 web 必須隨時可部署、可回滾、可用。三層安全網：

1. **Branch 隔離**：整個 migration 在 `ios-p0-monorepo` branch，main 不動 → main 隨時可重新 deploy 舊結構。
2. **Merge gate**：App Hosting branch build 未全綠**不准 merge**。production auto-build 只在 merge 後發生。
3. **Merge 後快速 rollback**：
   - 若 merge 後 production build 紅或行為異常 → `git revert` 該 merge commit（保留歷史，比 reset 安全）→ push main → App Hosting 重 build 回舊結構。
   - **同時**把 Console backend Root directory 改回 `/`（因為 revert 後結構回到 root）。⚠️ 這格是手動的，rollback 時別漏。
   - App Hosting 亦支援 rollout rollback 到上一個成功 build（Console → App Hosting → Rollouts），可作為更快的緊急手段。
4. **functions / rules / indexes 不在 P0 動** → backend 零回滾面。

> Rollback 的兩個手動點：(a) `git revert` + push，(b) Console Root directory 改回 `/`。兩者要成對做，否則 firebase.json rootDir 與 console 不一致 → build 找不到 app。

---

## 🤝 Handoff → iOS Backend

**Scope**：主導 Step 1-6 + Step 8。

必做：
- [ ] npm workspaces 結構（root + apps/web + packages stub）
- [ ] `firebase.json` apphosting.rootDir → `apps/web`
- [ ] **Console backend `mango-pet` Root directory → `/apps/web`**（auto-build；不做 = production 紅）
- [ ] App Hosting branch build 全綠 gate 才 merge
- [ ] `packages/shared-types` 抽 1 個 type，web 端 import 驗證通
- [ ] Firebase iOS app 註冊（同 `mango-pet-app` project，bundle id 建議 `com.mangopet.app`）+ 取得 `GoogleService-Info.plist`
  - `npx firebase apps:create IOS "Mango Pet iOS" --bundle-id com.mangopet.app --project mango-pet-app`
  - `npx firebase apps:sdkconfig IOS <APP_ID> --project mango-pet-app`
- [ ] **不動** functions / rules / indexes / storage / .firebaserc

護欄：
- 不重做 backend；iOS 接同一 project / schema / functions。
- `git mv` 保留歷史；不要 delete+create。
- 任何 App Hosting build 紅 → 停手，不硬 merge。

需要 PM 決策時回 iOS PM。

## 🤝 Handoff → iOS Feature Builder

**Scope**：Step 7 — `apps/ios` Expo scaffold（在 monorepo migration merge 後，或 branch 上並行於 packages 之後）。

必做：
- [ ] `apps/ios` Expo Managed init（Expo Router）
- [ ] `@react-native-firebase/*` 接 `mango-pet-app`（用 iOS Backend 給的 `GoogleService-Info.plist`）
- [ ] Auth flow：Google Sign-In + **Apple Sign-In**（Apple guideline 強制，若提供第三方登入必附 Apple）
- [ ] BottomNav skeleton：5 tabs + raised center disc（對齊 web IA）
- [ ] import `@mango/shared-types` 的那 1 個 type，typecheck pass → 證明 **ios 端**共享機制也通
- [ ] EAS Build setup + 首次 build 到 simulator

P0 Milestone（Feature Builder 端）：Expo build 跑起來 + login + 看到空白 bottom nav + 成功 import shared package。

不做：任何 feature parity（walks/pets/feed 等是 P1+）。

依賴：需 iOS Backend 先交付 `GoogleService-Info.plist` + `packages/shared-types` 已建。

---

## ✅ P0 驗收清單（iOS PM 收尾用）

Web 沒破：
- [ ] `npm run -w apps/web typecheck` pass
- [ ] `npm run -w apps/web build` pass
- [ ] App Hosting branch build 全綠（merge gate）
- [ ] merge 後 production auto-build 綠 + Chrome MCP golden path 正常

Monorepo 成立：
- [ ] 單一 workspace `package-lock.json`
- [ ] `apps/web` / `apps/ios` / `packages/*` 結構就位
- [ ] functions/rules/indexes 仍在 root，deploy 不受影響（不需實 deploy，確認路徑未動即可）

共享機制通：
- [ ] `packages/shared-types` 1 個 type 被 **web + ios 雙邊** import + 各自 typecheck pass

iOS 跑得起來：
- [ ] Expo build to simulator 成功
- [ ] login（Google + Apple）work
- [ ] 空白 bottom nav 顯示

回滾就緒：
- [ ] 確認 `git revert` + Console root 改回 `/` 的雙手動點已寫進本 spec（已寫）並 user 知悉

---

## ⚠️ Open questions（交 iOS Backend 評估後回 iOS PM）

1. **App Hosting 在 npm workspaces subdir 的 install 行為** — Step 5 branch 實測確認；若 hoisting 導致 build 找不到 web deps，評估是否 web 留 self-contained deps（不 hoist）或調 install 指令。
2. **Apple Sign-In 後端**：iOS 加 Apple Sign-In 後，user doc / auth provider 是否需 backend 任何相容處理（既有 Google flow → 新 provider）。預估僅 client，但要 iOS Backend 確認 `users/{uid}` 寫入路徑相容。
3. **`packages/shared-tokens` 雙輸出格式**（web Tailwind config + ios theme.ts）落地細節 → P1 再定，P0 只放 stub。

## 跟其他 spec 的關聯

- 上承 [`ios-app-strategy.md`](./ios-app-strategy.md) P0 Foundation（本 spec 為其可執行細化 + npm workspaces 決策覆蓋）。
- 前置 [`pre-ios-cleanup.md`](./pre-ios-cleanup.md) ✅ RESOLVED。
- 下接 P1 Walks（strategy spec P1）。
