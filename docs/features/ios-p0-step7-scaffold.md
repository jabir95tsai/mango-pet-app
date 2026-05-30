# iOS P0 Step 7 — apps/ios Expo Scaffold (ship note)

狀態：**SCAFFOLD DONE (code) / SIMULATOR BUILD PENDING (macOS step)**
建立日期：2026-05-31
角色：**iOS Feature Builder**
上承：[`ios-p0-monorepo-migration.md`](./ios-p0-monorepo-migration.md) §Handoff → iOS Feature Builder（Step 7）
parity：[`ios-parity-checklist.md`](./ios-parity-checklist.md) §A P0

## 做了什麼（全部在 `apps/ios/**`，未碰 `packages/*` / web / backend）

Expo Managed + Expo Router scaffold：

- **Config**：`package.json`（Expo SDK 52 / RN 0.76.5 / expo-router 4）、`app.json`（bundle `com.mangopet.app`、`usesAppleSignIn`、`googleServicesFile` 指 plist、Firebase + Google + build-properties config plugins、`useFrameworks: static`）、`tsconfig.json`（extends expo base + `@/*` paths）、`babel.config.js`、**monorepo-aware** `metro.config.js`（watch workspace root + 解析 hoisted root node_modules）、`eas.json`(dev/preview = simulator build)、`.gitignore`。
- **Routing / auth gate**：`app/_layout.tsx`（AuthProvider + SafeArea + GestureHandler；依 auth state redirect：未登入→`(auth)/sign-in`，登入→`(tabs)/walks`，對齊 web default landing = walks）。
- **Auth flow**：`src/lib/auth.ts` — Google（`@react-native-google-signin` → idToken → `auth.GoogleAuthProvider.credential` → 同一個 Firebase session）+ **Apple Sign-In**（`expo-apple-authentication` + hashed nonce → `auth.AppleAuthProvider.credential`）。`app/(auth)/sign-in.tsx` 用原生 `AppleAuthenticationButton`（僅在可用時顯示）。Apple guideline 4.8 強制（parity checklist §A native upgrade）。
- **Firebase**：`src/lib/firebase.ts` — `@react-native-firebase/{auth,firestore,storage,messaging}`，同 `mango-pet-app` project，從 `GoogleService-Info.plist` 原生自動初始化。**不重做 rules / indexes / functions**。
- **BottomNav**：`src/components/raised-tab-bar.tsx` — 自寫 5-tab bar + 中央 raised disc（walks），對齊 web Epic 4 Phase 0.5 IA `[首頁, 寵物, 遛狗(中央), 排行, 設定]`。
- **Theme**：`src/theme/theme.ts` **import `mangoColors` from `@mango/shared-tokens`**（零色票複製貼上）+ P0 本地 spacing/radius scale（P1 再移進 shared dual-output）。
- **Shared-types proof**：`src/lib/pets.ts` `import type { Pet } from "@mango/shared-types"`，`app/(tabs)/pets.tsx` 使用 → 證明 **iOS 端**共享機制通（milestone 要求）。
- **Screens**：5 個空白 tab screen（settings 含登出，閉合 auth loop）。

## 驗證了什麼

- ✅ 檔案結構 / import 路徑 / shared package wiring。
- ✅ `npx tsc --noEmit`（`-w apps/ios`）— 見 commit 描述狀態。
- ⏳ **EAS Build → iOS simulator / login / 空白 bottom nav 實跑**：**無法在 Windows 執行**（本 dev 機無 macOS / Xcode simulator；EAS cloud build 需 Expo 帳號互動登入）。屬 macOS / EAS 步驟，見下方。

## ⚠️ 剩餘步驟（macOS / EAS — 需 user 或 Mac 環境）

```bash
cd apps/ios
npx expo install --fix          # 對齊 SDK 52 精確版本（Windows 已裝可跑的近似版本）
npx eas login                   # 互動
npx eas init                    # 寫入 extra.eas.projectId
npx eas build --profile development --platform ios   # simulator build
# 下載 .app → 拖進 iOS Simulator → 登入 → 看到空白 bottom nav（= P0 milestone）
```

> Expo Managed 不 commit 原生 `ios/` 目錄（`.gitignore` 已排除）；EAS / `expo prebuild` 會從 config plugins 生成。

## 🔴 Open items / handoff

| # | 項目 | 交給 | 說明 |
|---|---|---|---|
| 1 | **Google Web client id** | iOS Backend | `src/lib/config.ts` 的 `GOOGLE_WEB_CLIENT_ID` 是 placeholder。Firebase 用 idToken 的 audience = project 722604603606 的 **Web** OAuth client（不在 plist，plist 只有 iOS client）。需填真值，否則 Google→Firebase credential 會失敗。 |
| 2 | **`eas init` projectId** | user / iOS Backend | `app.json` 未塞 `extra.eas.projectId`，留給 `eas init` 寫入。 |
| 3 | **Apple Sign-In capability** | iOS Backend | Apple Developer App ID 需開 "Sign In with Apple" capability + Firebase Console Apple provider 啟用。`usesAppleSignIn:true` 已設 client 端。 |
| 4 | **simulator build 實跑 + milestone 簽收** | iOS PM / user（macOS） | 跑通後回填本 note 狀態 + parity checklist §A P0 三列改 ✅。 |
| 5 | **App icon / splash** | P7（不在 P0） | app.json 暫用 Expo 預設。 |

## 護欄遵守

- 只動 `apps/ios/**`；**未改** `packages/*`（只 import）、web、functions、rules、indexes → 無並行衝突面（parallel-guarded OK）。
- 不做任何 P1 walks feature（walks tab 是空白 placeholder）。
