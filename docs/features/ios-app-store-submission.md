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
- ✅ **App icon 1024²**（2026-09-27 確認乾淨 Mango master，非 placeholder，非預圓角）
- ✅ **UGC 檢舉/封鎖**（2026-09-27 code done + 部署，見下方 UGC 段落）
- ✅ **App Store Connect listing 文案草稿**（2026-09-27，見 [`ios-app-store-listing.md`](./ios-app-store-listing.md)）

## ❌ 缺（上架 blocking，要補）

### Apple 帳號 / Console（user 手動）
- **App Store Connect 建立 App 紀錄**：name / SKU / 主要語言 / bundle id。尚未建。
- **Agreements 接受**：App Store Connect → Agreements, Tax, and Banking 要接受（免費 app 也要接 Free Apps 協議），否則無法送審。
- **APNs Auth Key (.p8)** 上傳 Firebase Console → Cloud Messaging：**push 真正送達的前置**（§parity 111 已記）。沒設 → token 能 mint 但收不到推播。

### 素材
- ✅ **App icon 1024²**（2026-09-27 確認）：`apps/ios/assets/icon.png` 實測 1024×1024、RGB 不透明、四角像素取樣確認**非預圓角**（角落與邊緣同色漸層，非白/透明遮罩）——是乾淨 Mango 芒果+爪印 icon，非 placeholder。`splash.png` 1242×1242 同樣確認存在。
- **截圖**：**6.7"（iPhone 15/16 Pro Max）必交**；`supportsTablet: true` → **iPad 截圖也必交**（見 ⚠️-iPad）。中英各一組。**尚未產生**——需要 EAS build 裝置或 simulator 截圖。
- （可選）App preview 影片。

### App Store Connect listing（PM 寫內容）— ✅ 草稿已完成
→ [`ios-app-store-listing.md`](./ios-app-store-listing.md)（2026-09-27）：描述（中+en）、關鍵字、副標題、分類建議（生活風格 主 / 社交 次）、年齡分級問卷逐項推薦答案、Support/Marketing/隱私政策 URL（沿用現有 Firebase Hosting 網域，不需等自訂網域）、App Privacy 資料標籤（已 grep 確認無 Analytics SDK，位置/照片/UGC/聯絡資訊/識別碼需申報）、審查備註英文草稿（guest 登入 + 背景定位 + UGC 審核機制）。**待你複製貼上進 ASC**——分類與年齡問卷仍要在 ASC 介面互動點選，這裡只給推薦答案。

### 送審管線
- ✅ **eas.json `submit.production`** 設定完成（2026-09-27 — ascAppId/appleId/team 全填）
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

### ⚠️ iPad 範圍 — ✅ user 拍板 **支援 iPad**（2026-06-03）；✅ 2026-09-27 responsive QA code done，待真機/simulator 目視驗證
`supportsTablet: true` 保留。代價：(a) **要交 iPad 截圖**（12.9"/13"）；(b) **iPad 上 layout 要能看**。

**2026-09-27 已做**（iOS UI/UX cross-role）：
- 新增 `CONTENT_MAX_WIDTH`（480pt，`apps/ios/src/theme/theme.ts`）——所有主要畫面的 `ScrollView` content 加 `maxWidth` + `alignSelf:"center"`，iPad 上呈現「置中、電話寬度的閱讀欄」而不是整頁拉伸：`(tabs)/index.tsx`（首頁）、`leaderboard.tsx`、`pets.tsx`、`settings.tsx`、`feed.tsx`、`family.tsx`、`friends/index.tsx`、`onboarding.tsx`、`photos.tsx`（含內部 2 欄 grid 寬度計算）+ 共用 `components/ui/Screen.tsx`（`walks.tsx` 用這個）。
- **`raised-tab-bar.tsx`（底部 5-tab nav）— 最嚴重的一處已修**：notch SVG 的 viewBox 是照 390pt（iPhone 參考寬）畫的、用 `preserveAspectRatio="none"` 拉伸，在 iPad 原始寬度（768–1366pt）下會把 notch 曲線嚴重扭曲、5 個 tab 間距被拉得很開。改成 bar 本身 cap 在 430pt 並置中（浮動膠囊 nav），phone 上因為螢幕寬度本來就 < 430pt，行為完全不變（no-op）。
- `post-card.tsx` 的照片 grid 寬度計算也同步 cap（不然卡片外層欄寬變窄了，但卡片內部還用裝置原始寬度算，照片會溢出卡片邊界）。
- **驗證方式的限制**：這台開發機是 Windows，沒有 macOS/Xcode/iOS Simulator，**這次改動全靠讀 code + 手算寬度邏輯，沒有實際跑在 iPad 尺寸畫面上看過**。`tsc --noEmit` 過，但這不能取代目視驗證。
- **👉 下一步（user）**：裝新 EAS build 在 iPad（或 Xcode iPad Simulator，若你有 Mac）走一輪 5 個分頁 + feed + settings + pets，確認：底部 nav 沒有被拉伸/扭曲、主要內容欄置中不頂滿版、feed 照片沒有溢出卡片。有任何一處還是難看，回報給下一個 iOS UI/UX session 微調（cap 寬度數字 480/430 可以再調）。

### ⚠️ 背景定位（§F）
Apple 重點審查。審查備註要講清 session-only、結束即停（§F.2 草稿）。最常見拒絕 = 用途不充分。

### ⚠️ 登入牆 / 審查員存取
app 一開要登入 → 審查員需能進。guest 登入可解（審查備註寫「點訪客即可體驗」），或提供 demo 帳號。

## 📋 建議順序（2026-09-27 更新 — 3 項已完成）

**決策**：Apple Glass redesign **defer 到上架後**；UGC 檢舉/封鎖 **✅ 已 code-done + 已部署**。

1. ✅ **UGC 檢舉/封鎖 — CODE DONE + 已部署（2026-09-27）**：`firebase deploy --only firestore:rules` + `functions:onReportCreated` 都成功。**剩：真人帳號端到端驗一次**（web 或 EAS build 裝置——檢舉貼文/留言 → 「已收到」提示;封鎖 → 對方內容從 feed 消失 + settings 能看到並解封鎖）。
2. ✅ **iPad responsive QA — CODE DONE（2026-09-27），待真機/simulator 目視驗證**（見上方 ⚠️-iPad 段落；開發機無 macOS，無法自己看過畫面）。
3. **user 手動**：
   - ✅ App Store Connect 建 App 紀錄（2026-09-27 — 已有 `ascAppId` 6816685055，代表 App 紀錄已建立）
   - Agreements, Tax, and Banking（含 Free Apps 協議）— **狀態待確認**
   - APNs Auth Key (.p8) 上傳 Firebase Console → Cloud Messaging — **狀態待確認**
4. ✅ **PM metadata 草稿完成（2026-09-27）** → [`ios-app-store-listing.md`](./ios-app-store-listing.md)：描述/關鍵字/分類建議/年齡分級推薦答案/URL 三件套/App Privacy 標籤/審查備註全部草稿好，**待你複製貼上進 ASC**（分類 + 年齡問卷仍要在 ASC 介面互動點選）。
5. ✅ **素材確認（2026-09-27）**：icon 1024² 乾淨非預圓角、splash 1242² 都確認存在。**尚缺**：截圖（6.7" + iPad，需要真機/simulator 產生，還沒做）。
6. ✅ **`eas.json` `submit.production` 已填完整（2026-09-27）**：`appleId`/`ascAppId`（`6816685055`）/`appleTeamId`（`5HGWLK54MK`）全部到位，可以 `eas submit` 了。
7. EAS production build（`eas build --profile production`）→ `eas submit` → **TestFlight 一輪** → 正式送審。

> 剩下的路徑清楚：③ ASC 帳號設定是 user 手動、擋住⑥；② iPad QA 需要開一個 iOS UI/UX code session；①的端到端驗證 + ⑤的截圖都需要一次 EAS build 或真機一起做。
