# iOS App Store 上架就緒清單（P7 submission）

狀態：**GAP AUDIT**（iOS PM 2026-06-03，**2026-08-26 re-check：狀態不變**）
目標：列出 Mango Pet iOS 上架 App Store 還缺什麼。標 ✅ 已備 / ❌ 缺（blocking）/ ⚠️ 風險。
配合：[`ios-parity-checklist.md`](./ios-parity-checklist.md) §F（背景定位審查）、[`ios-uiux-fidelity-gaps.md`](./ios-uiux-fidelity-gaps.md) §S0（icon）

> **2026-08-26 re-check**（user：「想先上架 app store 了」）：距上次 audit 近 3 個月，其間唯一 iOS 相關進度是 **Apple Glass 設計系統 spec**（`ios-apple-glass-design-system.md`，2026-06-03 立、**never started** — 未裝 `expo-blur`）+ dev-client 工具鏈（`expo-dev-client`，6/22）。**下面清單逐項複查，全部原封不動**：UGC 檢舉/封鎖仍 0 實作（grep 全 repo 無 `reportPost`/`blockUser`）、iPad responsive QA 未做、`eas.json` `submit.production` 仍空物件、icon/splash 檔案存在（`apps/ios/assets/icon.png`+`splash.png`，6/6 加入）但未逐項確認是否乾淨 1024² master。**Apple Glass 重新設計不是上架必要項** — 建議明確 defer 到上架後，把僅存心力全押在下面「❌ 缺」清單，才是「先上架」最短路徑。

> 功能面 P1–P7 已 code-done（含背景 GPS / push / 社群 feed / 家庭 / 好友 / 刪帳號 / 匯出）。下面是「上架」這道關卡缺的東西，多數**不是寫功能**，是 Apple 帳號設定、metadata、合規、素材。

## ✅ 已備（不用再做）
- Apple Developer 會員（D2，已購）、bundle id `com.mangopet.app`
- **Sign in with Apple**（`usesAppleSignIn`，Apple 強制：有第三方登入必附）
- **加密合規** `ITSAppUsesNonExemptEncryption: false`
- **權限 usage strings**（location/camera/photo 都在 app.json）
- **背景定位 entitlement** + session-only 行為（§F）
- **App 內刪除帳號**（`deleteUserAccount`）← Apple 強制（有註冊就要能刪），常見拒絕點，已有 ✅
- **資料匯出**（`exportUserData`）
- app.json 已設 `icon`（確認是真 Mango master、非 placeholder/512 略軟版 → 見 ❌-icon）

## ❌ 缺（上架 blocking，要補）

### Apple 帳號 / Console（user 手動）
- **App Store Connect 建立 App 紀錄**：name / SKU / 主要語言 / bundle id。尚未建。
- **Agreements 接受**：App Store Connect → Agreements, Tax, and Banking 要接受（免費 app 也要接 Free Apps 協議），否則無法送審。
- **APNs Auth Key (.p8)** 上傳 Firebase Console → Cloud Messaging：**push 真正送達的前置**（§parity 111 已記）。沒設 → token 能 mint 但收不到推播。

### 素材
- **App icon 1024²**：app.json 指 `./assets/icon.png` → **確認是乾淨 1024² Mango master（不透明、不預圓角）**，不是 Expo 預設或 512 上採樣的略軟版。
- **Splash**：Mango brand asset（icon session 處理中）。
- **截圖**：**6.7"（iPhone 15/16 Pro Max）必交**；`supportsTablet: true` → **iPad 截圖也必交**（見 ⚠️-iPad）。中英各一組。
- （可選）App preview 影片。

### App Store Connect listing（PM 寫內容）
- **描述**（中 + en，~300 字）、**關鍵字**、副標題、宣傳文字
- **分類**（主：生活風格 或 健康健身，二擇一拍板）+ 次分類
- **年齡分級問卷**
- **Support URL**（必填）+ Marketing URL（選）
- **隱私政策 URL（必填）**：web 有 `/privacy`，需公開可達的 URL（production 網域）
- **App Privacy 資料標籤問卷**：申報 Firebase 蒐集的資料類型（位置、照片/使用者內容、識別碼、用量、聯絡資訊？）— 漏報/錯報會被拒
- **審查備註**：附 (a) 背景定位用途說明（§F.2 英文草稿）+ (b) 登入方式（guest 可進，或附 demo 帳號讓審查員用）

### 送審管線
- **eas.json `submit.production`** 設定（ascAppId / Apple ID / team）或互動式 `eas submit`
- **EAS production build**（`eas build --profile production`，會 autoIncrement buildNumber）
- **TestFlight internal beta**：上 App Store 前先跑一輪自己/家人測（強烈建議；也提早暴露背景定位/push 審查問題）

## ⚠️ 風險（非顯而易見，可能被拒）

### 🔴 UGC 審查（Guideline 1.2）— ✅ 2026-09-27 CODE DONE，待部署+實機驗
app 有**社群 feed**（貼文 / 留言 / 反應 / 好友）= 使用者產生內容（UGC）。Apple 1.2 要求 UGC app 必須有：
1. **檢舉內容**（report post/comment）
2. **封鎖使用者**（block abusive user）
3. **過濾機制** + 對檢舉**採取行動**（24h 內移除 + 移除違規者）
4. **EULA**（可用 Apple 標準 EULA）

→ ✅ **已實作**（見 [`ugc-moderation.md`](./ugc-moderation.md) §2026-09-27 實作紀錄）：`reports`/`moderationAudit` rules + `onReportCreated` trigger（達 3 報自動 hidden）+ web/iOS 檢舉/封鎖 UI + client 過濾 + rules 層擋封鎖者互動 + `/terms` 零容忍條款。三個 `tsc --noEmit` 全過。
→ **⚠️ 還沒做**：`firebase deploy --only firestore:rules,functions:onReportCreated` 部署（rules/functions 在 repo 裡但還沒推上 production）+ EAS build 實機驗證檢舉/封鎖流程一次跑通。**部署前確認不影響現有 feed/comments（rules 改動影響 web+iOS 共用後端）**。

### ⚠️ iPad 範圍 — ✅ user 拍板 **支援 iPad**（2026-06-03）
`supportsTablet: true` 保留。代價：(a) **要交 iPad 截圖**（12.9"/13"）；(b) **iPad 上 layout 要能看**（RN 畫面原為 phone 設計 → 需一輪 **iPad responsive QA**，避免大螢幕拉伸/留白破版 → 交 iOS UI/UX）。列入上架前工項。

### ⚠️ 背景定位（§F）
Apple 重點審查。審查備註要講清 session-only、結束即停（§F.2 草稿）。最常見拒絕 = 用途不充分。

### ⚠️ 登入牆 / 審查員存取
app 一開要登入 → 審查員需能進。guest 登入可解（審查備註寫「點訪客即可體驗」），或提供 demo 帳號。

## 📋 建議順序（2026-08-26 user 拍板，以此為準）

**決策**：Apple Glass redesign **defer 到上架後**（見 [`ios-apple-glass-design-system.md`](./ios-apple-glass-design-system.md)）；UGC 檢舉/封鎖 **下一個 dev session 立即開工**（唯一硬性 code blocker）。

1. ✅ **UGC 檢舉/封鎖 — CODE DONE（2026-09-27）**，剩：`firebase deploy --only firestore:rules` + functions 部署 → 部署後 web/iOS 各跑一次檢舉+封鎖端到端驗證（`ugc-moderation.md` §✅ 驗收清單）。這條部署+驗完才算真正解掉 Guideline 1.2 blocker。
2. **iPad responsive QA**（`supportsTablet:true` 已拍板保留）→ iOS UI/UX 一輪，避免大螢幕拉伸/留白破版（截圖也要交 iPad 版）。
3. **user 手動（可與 1、2 平行進行，不擋 dev）**：
   - App Store Connect 建 App 紀錄（name/SKU/主要語言/bundle id）
   - 接受 Agreements, Tax, and Banking（含 Free Apps 協議）
   - APNs Auth Key (.p8) 上傳 Firebase Console → Cloud Messaging
4. **PM 寫 metadata**（下一個 iOS PM session）：描述（中+en）/ 關鍵字 / 分類 / 隱私政策 URL（web `/privacy` 已有，需確認 production 可達）/ App Privacy 資料標籤問卷 / 審查備註（背景定位用途 + 登入方式說明）。
5. **素材確認**：`apps/ios/assets/icon.png`（6/6 已加入，需目視確認是乾淨 1024² Mango master、非糊版）+ splash + 截圖（6.7" 必交 + iPad 若 supportsTablet true）。
6. **`eas.json` `submit.production`** 目前是空物件 `{}` → 需填 ascAppId/Apple ID/team（或改走互動式 `eas submit`）。
7. EAS production build（`eas build --profile production`）→ `eas submit` → **TestFlight 一輪** → 正式送審。

> UGC（步驟 1）是唯一必須寫 code 才能過審的項目，其餘多是 user 手動（Apple 帳號/Console）+ PM 內容（metadata）+ 素材確認。步驟 1–3 可平行推進，加速上架時程。
