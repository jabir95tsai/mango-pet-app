# iOS P0 — User Setup Tracker（手動步驟 + 收集到的值）

狀態：**✅ P0 COMPLETE**（2026-05-31 iPhone 實機簽收：Google + Apple 登入通 + 空白 5-tab nav 顯示）
維護：iOS PM（記錄用；config 寫入由 iOS Backend 執行）
配合：[`../features/ios-p0-monorepo-migration.md`](../features/ios-p0-monorepo-migration.md)、[`../features/ios-parity-checklist.md`](../features/ios-parity-checklist.md)

> 專案：`mango-pet-app`（722604603606）　bundle id：`com.mangopet.app`
> client id / projectId 都是 **public config**（非 secret），可進 repo。

## 收集到的值（給 iOS Backend 抄）

| 項目 | 值 | 去處 |
|---|---|---|
| **Expo EAS projectId** | `856804a1-4bb8-40de-99ca-2086a35ceca4`（@jabir95tsai/mango-pet）| ✅ 已由 `eas init` 寫入 `apps/ios/app.json`（待 iOS Backend commit） |
| **Google Web client id** | `722604603606-oepafc9cc8r6i5dgtg9rlk2l75pdv0lr.apps.googleusercontent.com` | ⬜ iOS Backend 填進 `apps/ios/src/lib/config.ts:15`（`GOOGLE_WEB_CLIENT_ID`） |
| **Google iOS client id** | `722604603606-ai03auqrk0l88utpvb090imkibsqsn4u.apps.googleusercontent.com`（來自 plist）| ✅ 已在 config.ts:12 |

### iOS Backend 待做的一行 edit
`apps/ios/src/lib/config.ts:14-15` 把 placeholder 換成真值：
```ts
export const GOOGLE_WEB_CLIENT_ID =
  "722604603606-oepafc9cc8r6i5dgtg9rlk2l75pdv0lr.apps.googleusercontent.com";
```
然後 `npx tsc --noEmit`（apps/ios）+ commit `app.json` 的 eas projectId 一起。

## 手動步驟進度

- [x] ① Expo / EAS 登入 + `eas init`（projectId 已建）
- [x] ④ 取得 Google Web client id（見上表，已交付）
- [x] ② Apple Developer portal → App ID `com.mangopet.app` → 啟用 **Sign In with Apple** capability（2026-05-31 done）
- [x] ③ Firebase Console → Authentication → Sign-in method → 啟用 **Apple** provider（2026-05-31 done）
- [x] ⑤ **EAS internal/dev build → iPhone 實機裝機驗 P0**（2026-05-31 ✅ 裝機成功 + login Google/Apple + 5-tab nav 全驗）

## ⚠️ 平台限制：user 無 macOS → P0 驗收走實機（非 simulator）

- EAS Build 是雲端編譯 → **build 不需要 Mac**（Windows OK）。
- iOS simulator 只能在 macOS 跑 → **不適用**。改走 **iPhone 實機 + EAS internal distribution build**。
- `@react-native-firebase` 是 native module → **不能用 Expo Go**，必須 EAS dev/preview build。
- 決策（user 2026-05-31）：先走 **EAS internal/preview build + QR 裝機**驗 P0；P7 上架前再走 TestFlight。

### eas.json 待改（iOS Backend code change）
現況 `apps/ios/eas.json`：`development` + `preview` 都 `ios.simulator: true`（= macOS simulator）。
實機要一個 **device profile**：`ios.simulator: false`（或移除該行）+ `distribution: "internal"`。
建議把 `preview` 改成 device（JS bundle 進 build，裝了直接跑、不用開 Metro，最適合純「看畫面 + 登入」驗收）。

### ⑤ 執行順序
**iOS Backend（CLI，先做）**
1. 改 `apps/ios/eas.json` preview profile → device（simulator:false, internal）。
2. `eas device:create` → 產生裝置註冊連結/QR（**順序很重要：要在 build 前先註冊，build 的 provisioning profile 才含這台 iPhone**）。
3. `eas build -p ios --profile preview` → 雲端 build（會要 Apple 帳號登入一次讓 EAS 管簽章）。
4. 把 device:create 連結 + build 頁 QR 交給 user。

**user（iPhone，後做）**
5. iPhone 開 `eas device:create` 連結 → 裝 provisioning profile（Settings → General → VPN & Device Management 可能要 Trust）。
6. iPhone 開 build QR/連結 → 裝 app。
7. 啟動 → 驗：**Google 登入 work + Apple 登入 work + 看到空白 5-tab bottom nav**。
8. 回報 iOS PM。

## 簽收後（iOS PM）
- 跑通 ⑤ → parity-checklist §A 的 P0 三列（Auth / BottomNav / tokens）由 ⬜ 改 ✅
- P0 milestone 收尾寫進 roadmap
