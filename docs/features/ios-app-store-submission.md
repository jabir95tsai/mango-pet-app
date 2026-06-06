# iOS App Store 上架就緒清單（P7 submission）

狀態：**GAP AUDIT**（iOS PM 2026-06-03）
目標：列出 Mango Pet iOS 上架 App Store 還缺什麼。標 ✅ 已備 / ❌ 缺（blocking）/ ⚠️ 風險。
配合：[`ios-parity-checklist.md`](./ios-parity-checklist.md) §F（背景定位審查）、[`ios-uiux-fidelity-gaps.md`](./ios-uiux-fidelity-gaps.md) §S0（icon）

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

### 🔴 UGC 審查（Guideline 1.2）— 最大非顯而易見風險
app 有**社群 feed**（貼文 / 留言 / 反應 / 好友）= 使用者產生內容（UGC）。Apple 1.2 要求 UGC app 必須有：
1. **檢舉內容**（report post/comment）
2. **封鎖使用者**（block abusive user）
3. **過濾機制** + 對檢舉**採取行動**（24h 內移除 + 移除違規者）
4. **EULA**（可用 Apple 標準 EULA）

→ **已實查確認：目前 web + iOS + functions 都沒有 reportPost / reportComment / blockUser 任何機制（grep 全空）= UGC 檢舉/封鎖不存在。**
→ **這是確定的上架 blocker（Guideline 1.2），且需寫 code（Feature Builder + Backend，非 PM）。** 最小可過審範圍：
  1. 貼文/留言「檢舉」（report → 寫 reports collection + 通知 / 自動隱藏門檻）
  2. 「封鎖使用者」（block → 被封鎖者內容不顯示 + 不能互動）
  3. 檢舉後的處置流程（24h 內移除違規 + 移除違規者）+ 標準 EULA 連結
→ **這同時影響 web（PWA 也是 UGC，但 web 不過 Apple 審查；不過為了一致 + 真實安全，建議 web/iOS 共用同一套 report/block backend）。優先做，會卡上架。**
→ ✅ **已 spec（2026-06-03）** → [`ugc-moderation.md`](./ugc-moderation.md)（檢舉 + 封鎖 + 處置 + EULA；shared backend + iOS/web UI）。

### ⚠️ iPad 範圍 — ✅ user 拍板 **支援 iPad**（2026-06-03）
`supportsTablet: true` 保留。代價：(a) **要交 iPad 截圖**（12.9"/13"）；(b) **iPad 上 layout 要能看**（RN 畫面原為 phone 設計 → 需一輪 **iPad responsive QA**，避免大螢幕拉伸/留白破版 → 交 iOS UI/UX）。列入上架前工項。

### ⚠️ 背景定位（§F）
Apple 重點審查。審查備註要講清 session-only、結束即停（§F.2 草稿）。最常見拒絕 = 用途不充分。

### ⚠️ 登入牆 / 審查員存取
app 一開要登入 → 審查員需能進。guest 登入可解（審查備註寫「點訪客即可體驗」），或提供 demo 帳號。

## 📋 建議順序
1. **先確認 UGC 檢舉/封鎖有沒有**（grep app + 問 Feature Builder）→ 沒有就補（這會卡上架，越早越好）。
2. **iPad scope 拍板**（supportsTablet true/false）。
3. user 手動：ASC 建 App 紀錄 + 接 Agreements + APNs key 上 Firebase。
4. PM 寫 metadata（描述/關鍵字/分類/隱私政策 URL/App Privacy 標籤/審查備註）。
5. 素材：確認 1024² icon + splash + 截圖（6.7"，+iPad 若 true）。
6. EAS production build → `eas submit` → **TestFlight 一輪** → 送審。

> 多數是 user 手動（Apple 帳號/Console）+ PM 內容（metadata）+ 少量素材;**唯一可能要寫 code 的是 UGC 檢舉/封鎖**（若還沒做）。
