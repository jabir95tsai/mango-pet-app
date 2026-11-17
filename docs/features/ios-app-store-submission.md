# iOS App Store 上架就緒清單（P7 submission）

狀態：**待確認 production build、實機驗收與送審資料**（2026-11-15 盤點）
配合：[商店文案](./ios-app-store-listing.md)、[roadmap](../roadmap.md)、[整合證據](../team/backlog.md)。

## 2026-11-15 送審交接

1. **iOS Backend：確認可上傳的候選 build。** Expo SDK 57 已整合，既有 EAS production / submit 設定可沿用；先確認 EAS 是否已有對應候選 commit 的 build。以 build log 確認 Xcode 26+ 與 iOS 26 SDK+，並核對正式簽章、推播 entitlement、隱私 manifest／required reason APIs，確認 App Store Connect 成功處理上傳。見 [Apple 上傳要求](https://developer.apple.com/news/upcoming-requirements/)及 [SDK 隱私要求](https://developer.apple.com/support/third-party-SDK-requirements/)。
2. **iOS PM／Bug Hunter：用同一顆 TestFlight build 批次驗收。** iPhone 走首登、建寵、鎖屏遛狗與結束停止定位、儲存與照片、推播送達和點擊、檢舉／封鎖、App 內刪帳。iPad 驗核心頁面與導覽；維持支援 iPad，拍 Apple 接受的大尺寸 iPhone 與 13 吋 iPad 規格截圖。Firebase APNs 狀態以 Console 及實機送達確認。前次靜態結果、Web rollout 與舊版 iPhone 簽收不算候選版的驗收。
3. **iOS PM／帳號持有人：完善 App Store Connect。** Repo 已記錄 App ID 6816685055；確認會員及最新開發者條款是否有效、現有 build／版本狀態，再填中英文文案、截圖、年齡分級、App Privacy、價格／地區及審查聯絡資訊。確認公開支援及隱私網址可達，提供客服聯絡方式。免費且無內購時不需 [Paid Apps Agreement](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/)。
4. **iOS PM／Backend：確認審查員能完整操作、社群有實際處置流程。** — ✅ **程式碼與文件已完成（2026-11-15）**，待部署 Cloud Functions／Hosting／Indexes 並建立正式環境審查員帳號後進入實機驗收：
   - **發文前不當內容過濾（§1.2）**：`@mango/shared-business` 已新增中英文不當字詞過濾，iOS 與 Web 的發文／留言送出前強制阻擋，Cloud Functions (`onPostCreatedAchievements` / `onCommentCreated`) 亦加入後端兜底自動隱藏。
   - **檢舉負責人與通知（§1.2）**：指定 **蔡智博（`jabir95tsai@gmail.com`）** 為社群審核負責人（24h SLA）；`onReportCreated` 新增結構化告警與 FCM 推播通知負責人，處置 SOP 見 [`ugc-moderation.md`](./ugc-moderation.md)。
   - **公開客服聯絡與條款對齊（§1.2）**：iOS 與 Web 設定頁皆新增「條款與客服支援 / Legal & Support」卡片（直連 `jabir95tsai@gmail.com`、隱私權與服務條款）；`/privacy` 與 `/terms` 已同步更新遛狗背景定位、訪客／Email 登入、App 內刪帳與三層社群審核機制。
   - **審查員登入存取（§2.1）**：iOS 與 Web 登入頁新增次要「使用 Email 帳號登入 / Sign in with Email」入口，並備妥冪等種子腳本 `functions/scripts/seed-reviewer-account.mjs`（預建寵物、遛狗紀錄與另一位示範用戶之公開貼文/留言供測檢舉與封鎖）；送審備註已更新於 [`ios-app-store-listing.md`](./ios-app-store-listing.md)。
   - **👉 上線前手動步驟**：(1) 確認 Firebase Authentication 已啟用 **Email/Password** provider；(2) 部署最新 `functions`、`firestore:indexes`（`private.email` collectionGroup index）與 Web Hosting（含 `/privacy`、`/terms` 更新）；(3) 執行 `node functions/scripts/seed-reviewer-account.mjs --generate-password --commit` 建立審查員帳號並將帳號密碼貼入 App Store Connect。參考 [App Review Guidelines §1.2、§2.1](https://developer.apple.com/app-store/review/guidelines/)。

**首版範圍（2026-11-16 使用者拍板）**：核心遛狗流程 + **首頁通知中心**（[規格](./ios-notification-center.md)；Backend 已部署、iOS code 完成）一起送審。TestFlight 批次驗收需加測：bell 紅點、今日／逾期提醒勾完成、留言／表情／好友邀請列與點擊導向、actor 已刪帳號列隱藏。**2026-11-16 更新**：[遛狗路線紀錄與家庭即時位置 v1](./ios-walk-route-tracking-v1.md) 亦納入 1.0（`codex/walk-route-backend` 已合併 main）；驗收依 [路線實機清單](./ios-walk-route-implementation.md)。新增原生依賴 `react-native-maps`、`expo-notifications`，送審備註「背景定位」段需補充路線歷史與家人位置分享（每次自行開啟、結束即停）。未即時查到 EAS／App Store Connect／Firebase Console；本地依 main `bf8854d` 及既有發布紀錄盤點，git fetch 因 FETCH_HEAD 寫入受限未更新遠端快照。未執行 build、送審或實機驗收。

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
- **App Store Connect App 紀錄**：已記錄 App ID 6816685055；版本及表單狀態待 Console 確認。
- **Apple Developer Program License Agreement**：確認會員與現行條款狀態。
- ✅ **APNs Auth Key (.p8)** 已上傳 Firebase（2026-11-17，正式版，Key ID `H9F7P88DLP`，Sandbox & Production）。待 TestFlight 實機確認推播送達。

### 素材
- ✅ **App icon 1024²**（2026-09-27 確認）：`apps/ios/assets/icon.png` 實測 1024×1024、RGB 不透明、四角像素取樣確認**非預圓角**（角落與邊緣同色漸層，非白/透明遮罩）——是乾淨 Mango 芒果+爪印 icon，非 placeholder。`splash.png` 1242×1242 同樣確認存在。
- **截圖**：**Apple 接受的大尺寸 iPhone 截圖**；`supportsTablet: true` → **iPad 截圖也必交**（見 ⚠️-iPad）。中英各一組。**尚未產生**——需要 EAS build 裝置或 simulator 截圖。
- （可選）App preview 影片。

### App Store Connect listing（PM 寫內容）— ✅ 草稿已完成
→ [`ios-app-store-listing.md`](./ios-app-store-listing.md)（2026-09-27）：描述（中+en）、關鍵字、副標題、分類建議（生活風格 主 / 社交 次）、年齡分級問卷逐項推薦答案、Support/Marketing/隱私政策 URL（沿用現有 Firebase Hosting 網域，不需等自訂網域）、App Privacy 資料標籤（已 grep 確認無 Analytics SDK，位置/照片/UGC/聯絡資訊/識別碼需申報）、審查備註英文草稿（guest 登入 + 背景定位 + UGC 審核機制）。**待你複製貼上進 ASC**——分類與年齡問卷仍要在 ASC 介面互動點選，這裡只給推薦答案。

### 送審管線
- ✅ **eas.json `submit.production`** 設定完成（2026-09-27 — ascAppId/appleId/team 全填）
- **EAS production build**（`eas build --profile production`，會 autoIncrement buildNumber）
- **TestFlight internal beta**：上 App Store 前先跑一輪自己/家人測（強烈建議；也提早暴露背景定位/push 審查問題）

## ⚠️ 風險（非顯而易見，可能被拒）

### 🔴 UGC 審查（Guideline 1.2）— 2026-11-15 已補齊全套防線，待部署後實機驗
app 有**社群 feed**（貼文 / 留言 / 反應 / 好友）= 使用者產生內容（UGC）。Apple 1.2 要求 UGC app 必須有：
1. **檢舉內容**（report post/comment）
2. **封鎖使用者**（block abusive user）
3. **發文前過濾不當內容**，並及時（24h 內）人工處理檢舉
4. **公開聯絡資訊與準確的 EULA／隱私權政策**，讓使用者能聯絡營運者

→ ✅ **已實作（2026-09-27 初版 + 2026-11-15 補齊 §1.2）**（見 [`ugc-moderation.md`](./ugc-moderation.md)）：`reports`/`moderationAudit` rules + `onReportCreated` 觸發通知負責人 **蔡智博 (`jabir95tsai@gmail.com`)** 與達 3 報自動隱藏 + 中英文發文／留言前置過濾（前端 + 後端兜底）+ web/iOS 檢舉／封鎖／設定頁聯絡客服 UI + `/terms` 零容忍條款與 `/privacy` 定位／刪帳同步。
→ **待完成**：部署更新後之 `functions`、`firestore:indexes` 與 Web `/privacy` `/terms`，並以最新候選版實機驗收過濾、檢舉推播與封鎖流程。

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

### ⚠️ 登入牆 / 審查員存取（Guideline 2.1）— ✅ 2026-11-15 已補 Email 登入入口與種子腳本
已新增次要「使用 Email 帳號登入 / Sign in with Email」入口及 `functions/scripts/seed-reviewer-account.mjs` 腳本，審查員不需綁定個人 Google／Apple 帳號即可測試寵物、遛狗與社群（含他人示範貼文之檢舉／封鎖）；送審前請依上述第 4 項步驟建立帳號並填入 ASC Sign-In Information。

## 📋 建議順序（2026-09-27 更新 — 3 項已完成）

**目前狀態（2026-11-14）**：舊 expo-blur 全介面 redesign 已封存；[原生 Liquid Glass](./ios-liquid-glass.md) 已整合 main、待實機驗收；UGC 檢舉/封鎖 **✅ 已 code-done + 已部署**。

1. ✅ **UGC 檢舉/封鎖 — CODE DONE + 已部署（2026-09-27）**：`firebase deploy --only firestore:rules` + `functions:onReportCreated` 都成功。**剩：真人帳號端到端驗一次**（web 或 EAS build 裝置——檢舉貼文/留言 → 「已收到」提示;封鎖 → 對方內容從 feed 消失 + settings 能看到並解封鎖）。
2. ✅ **iPad responsive QA — CODE DONE（2026-09-27），待真機/simulator 目視驗證**（見上方 ⚠️-iPad 段落；開發機無 macOS，無法自己看過畫面）。
3. **user 手動**：
   - ✅ App Store Connect 建 App 紀錄（2026-09-27 — 已有 `ascAppId` 6816685055，代表 App 紀錄已建立）
   - Apple Developer Program 會員及現行條款— **狀態待確認**
   - ✅ APNs Auth Key (.p8) 已上傳 Firebase（2026-11-17，Key ID `H9F7P88DLP`）
4. ✅ **PM metadata 草稿完成（2026-09-27）** → [`ios-app-store-listing.md`](./ios-app-store-listing.md)：描述/關鍵字/分類建議/年齡分級推薦答案/URL 三件套/App Privacy 標籤/審查備註全部草稿好，**待你複製貼上進 ASC**（分類 + 年齡問卷仍要在 ASC 介面互動點選）。
5. ✅ **素材確認（2026-09-27）**：icon 1024² 乾淨非預圓角、splash 1242² 都確認存在。**尚缺**：截圖（大尺寸 iPhone + 13 吋 iPad，需要真機/simulator 產生，還沒做）。
6. ✅ **`eas.json` `submit.production` 已填完整（2026-09-27）**：`appleId`/`ascAppId`（`6816685055`）/`appleTeamId`（`5HGWLK54MK`）全部到位，可以 `eas submit` 了。
7. EAS production build（`eas build --profile production`）→ `eas submit` → **TestFlight 一輪** → 正式送審。

> 剩下的路徑清楚：③ ASC 帳號設定是 user 手動、擋住⑥；② iPad QA 需要開一個 iOS UI/UX code session；①的端到端驗證 + ⑤的截圖都需要一次 EAS build 或真機一起做。
