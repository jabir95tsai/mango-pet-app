# UGC Moderation — 檢舉 / 封鎖 / 處置（App Store Guideline 1.2 合規）

狀態：**CODE DONE（含發文前過濾 + 檢舉人通知 + SOP），待部署更新並實機驗證**（2026-11-15 補齊 §1.2 全套防線；初版 2026-09-27）
規格作者：iOS PM session
角色執行：**Backend**（shared functions/rules + 資料模型）+ **iOS Feature Builder**（iOS UI）+ **Web Feature Builder**（web UI parity）— 跨角色完成
配合：[`ios-app-store-submission.md`](./ios-app-store-submission.md) §UGC

## ✅ 2026-11-15 送審補齊紀錄（Guideline 1.2 全項合規）
- **發文／留言前不當內容過濾（Pre-post Filter）**：
  - `@mango/shared-business` (`packages/shared-business/src/moderation.ts`) 新增 `findObjectionableTerm` / `hasObjectionableContent`（支援中英文不當字詞 + NFKC / 混淆符拆解，並以詞邊界與白名單設計避免誤傷「公狗 / 母狗 / 發情 / 結紮 / 大便 / 尿尿 / cockapoo / shih tzu」等正常養寵用語）。
  - iOS 與 Web 端 `createPost` / `createComment`、`PostComposer`、`CommentSection` 送出前強制檢查，命中即擋下並顯示 `Moderation.objectionableContentBlocked`。
  - Cloud Functions (`functions/src/moderation-helpers.ts` → `autoModerateCreatedContent`) 於 `onPostCreatedAchievements` 與 `onCommentCreated` 雙重兜底：若有人繞過前端寫入不當文字，後端立即標記 `hidden: true`、`autoHiddenReason: "objectionable_text"` 並寫入 `moderationAudit`，且不發送新留言推播。
- **專人檢舉通知與處理 SOP**：
  - 指定營運與社群審核負責人：**蔡智博 (`jabir95tsai@gmail.com`)**（24 小時內處理 SLA）。
  - `onReportCreated` (`functions/src/index.ts`) 於收到新檢舉（`counted` / `logged`）時記錄結構化 `moderation_report_received` alert，並透過 `MODERATION_ADMIN_UID` 環境變數或 `users/{uid}/private/contact.email == "jabir95tsai@gmail.com"` 查詢（需部署 `firestore.indexes.json` 中 `private.email` collectionGroup index）發送 FCM 推播給負責人。
- **公開聯絡方式與政策對齊**：
  - iOS & Web 設定頁皆新增「條款與客服支援 / Legal & Support」卡片，公開列出 `聯絡客服（jabir95tsai@gmail.com）`（`mailto:` + 無法開啟郵件 App 時的聯絡提示 Alert）以及隱私權政策／服務條款連結。
  - `/privacy` 與 `/terms` 已同步為最新內容：說明 iOS 僅於遛狗中開啟背景定位、提供 App 內刪帳、支援訪客／Email 登入，並載明三層社群審核防線與 24 小時處置承諾。

## 🛠️ 營運處置 SOP（24 小時內人工審核）
收到 FCM `[檢舉通知]` 推播或 Cloud Logging `moderation_report_received` 告警時：
1. 開啟 Firebase Console → Firestore Database：
   - 查看 `reports`（依 `createdAt` desc 排序）及 `moderationAudit`（核對 `reportCount`、`targetType`、`targetId`、`postId`、`targetAuthorUid`、`reason`、`note`）。
2. 若目標為 `post`（`posts/{targetId}`）或 `comment`（`posts/{postId}/comments/{targetId}`）：
   - 確認違規屬實時，在 Firestore 將該文件設為 `hidden: true` 或直接刪除違規貼文／留言，並將對應 `reports/*` 文件 `status` 更新為 `"actioned"`；若屬誤報則設 `"dismissed"`。
   - 若僅需緊急覆寫已被誤隱藏的正常貼文，將 `hidden` 改回 `false`。
3. 若帳號（`targetAuthorUid`）屢次違規或發布嚴重違法／騷擾內容：
   - 至 Firebase Console → Authentication → 搜尋 `targetAuthorUid` → **Disable account**（停用帳號），並刪除其違規內容。

## ✅ 2026-09-27 初版實作紀錄
- **Backend**：`firestore.rules`（`reports`/`moderationAudit` collections + `authorBlockedMe()` 擋封鎖者留言/反應 + `posts.hidden`/`reportCount` 禁止 client 寫）+ `functions/src/moderation-helpers.ts` + `onReportCreated` trigger（達 3 報 → hidden=true + 寫 `moderationAudit` audit doc，無 admin dashboard，開發者用 Firestore console 看）。`@mango/shared-types`（Report/ReportReason + Post/Comment 的 hidden/reportCount）+ `@mango/shared-business`（`filterVisible`/`isAuthorBlocked`）。
- **Web**：`post-menu.tsx`（⋯選單：檢舉 reason Dialog + 封鎖 confirm）接進 `post-card.tsx` + `comment-section.tsx`；`listFeedPosts`/`listComments` 加 `blockedUids` 過濾；`users.ts` 加 `blockUser`/`unblockUser`/`getBlockedUids`；settings 新增 `blocked-users-section.tsx`（解封鎖列表）；`/terms` 加零容忍條款段落。
- **iOS**：對應 RN 版本 —`post-menu.tsx` 用 `ActionSheetIOS`/`Alert`（iOS-only app，不需自建 dropdown）；`feed-data.ts`/`posts.ts`/`user-prefs.ts` 加對應過濾與 block/unblock；settings 新增 `blocked-users-section.tsx`。
- **驗證**：`functions`/`apps/web`/`apps/ios` 三個 `tsc --noEmit` 全過；firestore.rules 大括號/括號配對檢查平衡。**尚未部署**（rules + functions 需 `firebase deploy` 才生效，未跑；也未做 emulator/實機端到端驗證）。
- **未做（刻意，非 blocker）**：EULA 顯式「同意」checkbox 流程（沿用既有被動連結模式，Settings + terms 頁零容忍條款已可滿足 Apple 最低要求）；report reason 附註欄位僅 web 有（iOS 為求簡潔，v1 只送 reason 不含 note）；admin dashboard（spec 本就排除）。

> Apple **Guideline 1.2**：有使用者產生內容（UGC）的 app 必須提供 (a) 檢舉內容 (b) 封鎖使用者 (c) 過濾 + 對檢舉採取行動（24h 內）(d) EULA。Mango 有社群 feed（貼文/留言/反應/好友）但**目前 0 機制**（grep 確認）→ 不補必被拒。
> ⚠️ **後端共用**：functions / rules 改動 **web + iOS 同時生效**。先在 branch 過 App Hosting + 規則部署驗證再上。

## 🎯 完成定義（最小可過審）
1. 貼文 + 留言可**檢舉**。
2. 可**封鎖使用者**：被封鎖者的內容在我這邊消失、不能跟我互動。
3. 檢舉**有處置**：達門檻自動隱藏 + 通知 admin（你）+ 你能移除違規內容/使用者。
4. **EULA / terms** 含「對 objectionable content 零容忍」條款，使用者同意。

## 📊 資料模型（Firestore，shared）
- **檢舉**：`reports/{reportId}`：`reporterUid` / `targetType`('post'|'comment'|'user') / `targetId` / `targetAuthorUid` / `reason`(enum: spam/harassment/inappropriate/other) / `note?` / `status`('open'|'actioned'|'dismissed') / `createdAt`。
- **封鎖**：`users/{uid}.blockedUids: string[]`（arrayUnion/arrayRemove）。
- **內容隱藏 denorm**：`posts/{id}.hidden:boolean`（default false）、`posts/{id}.reportCount`、留言同理（`comments/{id}.hidden`）。

## 🔧 後端（Backend role — shared functions/rules）
1. **rules**：
   - `reports`：`create` 限 `request.auth != null && reporterUid == auth.uid`；`read/update` 僅 admin（無 client 讀）。
   - `users/{uid}.blockedUids`：僅本人可改。
   - posts/comments：`hidden==true` 的讀取維持（client 過濾即可），但**被封鎖者不能在我貼文留言/反應**（rule 檢查 author 不在貼文主人的 blockedUids；或最小版交給 client + 事後處置）。
2. **functions**：
   - `onReportCreated`（onCreate `reports/*`）：targetreportCount++；達門檻（建議 3）→ `hidden=true`；發 admin 通知（你既有 push/FCM 或寫 audit doc）。
   - （可選）`onContentCreated` 基本髒字過濾 → 命中即 `hidden=true` 待審。最小版可不做，靠 report-driven。
3. **處置工具**（最小）：admin 能把 `report.status` 設 actioned + 刪內容/封帳號（可先用既有刪除 + 手動，Apple 接受人工 24h 處置）。

## 📱 iOS UI（iOS Feature Builder）
- **貼文/留言檢舉**：PostCard / CommentRow 的「⋯」選單 → 檢舉（選 reason）→ 寫 report → toast「已檢舉」。
- **封鎖**：使用者 profile / 貼文作者「⋯」→ 封鎖 → arrayUnion blockedUids + confirm。
- **過濾**：feed / 留言 / 好友列表 client 過濾掉 `authorUid ∈ myBlockedUids` 或 `hidden==true` 的內容。
- **EULA 同意**：onboarding 或登入時顯示 terms + 「同意」；settings 放 terms 連結。
- 檢舉/封鎖 helper 抽 `@mango/shared-business` 供 web+iOS 共用（query 過濾邏輯一致）。

## 🌐 Web parity（Web Feature Builder — 交接）
web 同樣是 UGC（雖不過 Apple 審查，但用同後端 + 真實安全需要）→ web feed/comment 也加檢舉/封鎖 UI + 同樣 client 過濾。**後端共用一套**（上面 functions/rules）。

## 🤝 執行順序
1. **Backend**：資料模型 + rules + `onReportCreated`（+ 過濾）→ branch 驗（App Hosting 綠 + rules deploy）。
2. **iOS Feature Builder**：iOS 檢舉/封鎖/過濾 UI + EULA 同意。
3. **Web Feature Builder**：web 同款 UI（parity）。
4. 抽 shared-business 過濾 helper。

## ✅ 驗收
- 檢舉貼文/留言 → report doc 落地;達 3 報 → 自動 hidden + 你收到通知。
- 封鎖某人 → 對方貼文/留言在我 feed 消失、不能在我貼文互動。
- terms 含零容忍條款 + 使用者同意流程。
- iOS + web 行為一致;後端 rules 部署沒破現有 feed。
- App Store 審查備註可寫「檢舉:貼文/留言⋯選單;封鎖:作者⋯選單;處置:24h 內人工移除 + 達門檻自動隱藏」。

## 🚫 不做（避免 over-build）
- 完整 admin dashboard（最小用 audit doc / 既有刪除 + 手動）。
- AI 內容審查（report-driven + 門檻自動隱藏即可過審）。
