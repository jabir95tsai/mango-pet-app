# UGC Moderation — 檢舉 / 封鎖 / 處置（App Store Guideline 1.2 合規）

狀態：**READY-FOR-DEV**（iOS PM 2026-06-03）— 上架硬 blocker
規格作者：iOS PM session
角色執行：**Backend**（shared functions/rules + 資料模型）+ **iOS Feature Builder**（iOS UI）+ **Web Feature Builder**（web UI parity）
配合：[`ios-app-store-submission.md`](./ios-app-store-submission.md) §UGC

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
