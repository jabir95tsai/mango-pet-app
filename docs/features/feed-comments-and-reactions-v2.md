# 動態互動 v2 — 留言 + FB 式表情選擇器

> **狀態**：READY-FOR-DEV — PM spec（2026-06-01；user 5 決策已拍板）。
> **角色分工**：Backend（comments 資料模型 + rules + comment/reaction push functions）→ UI/UX（留言 UI + FB 式 reaction picker 互動 + a11y）。
> **歸屬**：社群動態（feed）互動強化；push 接 Epic 5 engagement-push 框架。
> **依賴**：實作排在 iOS P0 / 當前並行期 main 乾淨時；動 production code 前讀近期 commit 避免撞檔。

## 背景（現況事實，立基於 code）

- **表情回應已存在**：`REACTION_EMOJIS = ["❤️","😂","🐶","👍","🎉"]`（`packages/shared-types/src/index.ts:50`）；**一人一篇單選 toggle**（`getMyReaction`/`setReaction`）；資料 `posts/{postId}/reactions/{uid}` + denormalized `post.reactionCounts`；UI `apps/web/src/components/feed/emoji-reactions.tsx`（目前**一次攤開全部 5 顆**按鈕）。
- **留言不存在**：`firestore.rules` 無 comments 子集合；無 comment 元件 / function。
- 貼文有可見度（public / friends / family）；reactions rules 已定義「誰能讀貼文 + 寫自己的 reaction」。

## User Story

> 作為使用者，我想在朋友/家人的動態底下**留言**，並用**多種表情**回應（像 FB 那樣按一下是愛心、長按可選別的），讓動態更有互動感；而且有人回應我的貼文時我想**收到通知**。

## 範圍（user 2026-06-01 拍板）

1. **留言**：平鋪（無巢狀回覆）v1。
2. **留言 / 表情權限**：跟貼文可見度一致（看得到該貼文的人就能留言 / 按表情）。
3. **通知**：有人留言或按表情 → 推播通知貼文作者（接 Epic 5 push）。
4. **表情 = FB 式選擇器**：**預設只露一顆愛心 ❤️**；**按住**愛心才彈出其餘表情（5 選 1）。**現有 5 個表情集先維持，不新增**；維持一人一篇單選（toggle / 取代）。

---

## A. 留言（交 Backend + UI/UX）

### 資料模型（Backend）
```
posts/{postId}/comments/{commentId}
```
- `authorUid`, `authorName`, `authorPhotoURL`（denormalize，避免讀者反查 user doc）
- `text`（trim 後非空；上限建議 500 字）
- `createdAt`（serverTimestamp）
- denormalized `post.commentCount: number`（onCreate +1 / onDelete -1）

### Rules（Backend）
- **read**：能讀該 post 的人即可讀其 comments（沿用 post 可見度判斷）。
- **create**：能讀該 post + `authorUid == auth.uid` + text 非空/長度限制。
- **delete**：`authorUid == auth.uid`（自己刪自己）**或** post 作者（自己貼文下的 moderation）。
- **update**：v1 不開放編輯（簡化）；或僅作者改自己 text（開放問題）。

### UI（UI/UX）
- PostCard 顯示 `commentCount` + 留言 icon/按鈕；點開 → 展開留言區（inline 或 bottom sheet）。
- 留言列：頭像 + 名字 + text + 相對時間；自己的留言可刪。
- 底部留言輸入框 + 送出（optimistic append）。
- **載入策略（控成本）**：點開才讀 comments（一次 query，依 createdAt 排序、可分頁 / 限 N 筆），**v1 不用 onSnapshot 即時**（省讀取）；即時留待之後評估。
- i18n（zh-TW + en）；空狀態「搶頭香留言」。

---

## B. FB 式表情選擇器（交 UI/UX，改 `emoji-reactions.tsx`）

**互動（取代現有「攤開 5 顆」）**：
- **預設**：只顯示一顆 ❤️ 按鈕 + 該貼文總回應數（= reactionCounts 加總）。已回應者顯示自己選的表情高亮。
- **點一下 ❤️**：toggle 愛心（你的 reaction = ❤️ / 再點取消）。
- **按住 ❤️（long-press）**：彈出 reaction tray（橫排現有 5 表情）→ 點選 → 你的 reaction 取代成該表情。
- **顯示**：像 FB 在貼文上顯示「出現過哪些表情 + 總數」(emoji cluster + count)。
- 維持**單選**（一人一篇一個 reaction；資料模型 `reactions/{uid}` 不變）。
- **動效**：tray 彈出動畫尊重 `prefers-reduced-motion: reduce`（reduce → 無動畫、直接出現）。
- **a11y（重要）**：long-press 對鍵盤 / 螢幕閱讀器不可達 → 需備援：tray 也能用「更多表情」可聚焦按鈕開啟；tray 內每個表情有 aria-label。桌機可用 hover 或點「更多」開 tray。

> 後端 reaction 模型完全不變（沿用 `setReaction` / `reactions/{uid}` / `reactionCounts`）。本項主要是**前端互動改版**。

---

## C. 通知（Backend，接 Epic 5 engagement-push 框架）

- **留言通知**：`onCreate(posts/{postId}/comments/{commentId})` → 推播貼文作者「{name} 留言了你的動態」。
- **表情通知**：reaction 新增時推播作者「{name} 回應了你的動態」。
- **必要守門（沿用 Epic 5 4 道 gate + 加碼）**：
  - 不通知自己（commenter/reactor == 貼文作者 → skip）。
  - 作者有 token、未 opt-out engagement push。
  - **Throttle / 去重（重要，避免洗版 + 成本）**：表情容易被連點/多人按 → 建議 aggregate（如「{name} 和其他 3 人回應了」）或對同一貼文同一作者設冷卻窗，不要每個 reaction 一則 push。留言可較即時但也建議短窗去重。
  - 沿用 engagementPushes 的 opt-out namespace。

---

## 成本備註（對齊控成本原則）

- 留言：點開才讀（非即時 onSnapshot）→ 控讀取量；commentCount denormalized 讓列表不用每篇 count。
- 表情通知**最花成本/最易洗版** → 必須 throttle/aggregate（見 C）。Backend 評估冷卻窗 / 聚合策略。
- 留言 + reaction push 走**現有 Epic 5 function 框架**，不另開外部 API。**無新增外部 recurring API 成本**；增量是 Firestore 讀寫 + FCM 推播量。

---

## 開放問題（可動工前快速定，PM 有預設）

1. **留言可編輯？** PM 預設 **v1 不可編輯**（只可刪）。
2. **留言分頁 / 上限**：一次載幾筆？PM 預設「最新 20 筆 + 載入更多」。
3. **表情通知聚合策略**：冷卻窗時長 / 「N 人回應」聚合門檻 → 交 Backend 提案。
4. **留言 push 文案 + 是否帶留言節錄**（隱私：family/friends 範圍內帶節錄應 OK）。

## Handoff

- **→ Backend**：comments 集合 + commentCount denorm + rules（read/create/delete 對齊 post 可見度）；`onCreate(comments)` + reaction push function（含 throttle/aggregate + Epic 5 gates + 不通知自己）。
- **→ UI/UX**：留言區 UI（展開 / 輸入 / 刪除 / 空狀態 / i18n）+ FB 式 reaction picker（預設愛心、長按彈 tray、單選、reduced-motion、a11y 備援）。
- **→ PM（後續）**：開放問題 1–4 收斂；上線後看互動率 + push opt-out 率（北極星：每動態互動數）。

---

## ✅ Backend 已交付（Backend session 2026-06-01 — commit 93e8272）

**Deployed to `mango-pet-app`**：firestore:rules + functions（onCommentCreated / onCommentDeleted / onReactionCreated 三個新建）部署成功，三函式 state=ACTIVE、Eventarc trigger 已註冊。**Prod e2e PASS**：建留言 → `post.commentCount` 0→1（3s）；刪留言 → 1→0（3s）；runtime log 無 error（僅 Node22 平台級 punycode DEP0040，全專案皆有，非本次程式碼）。reaction push 未跑實機 e2e（會對 prod 真實使用者發推播且需真 FCM token）；自我守門 + throttle transaction 邏輯走的是 Epic 5 已驗證的同一條 `sendEngagementPush` path。**未新增 composite index**（comments 在單一子集合內 orderBy createdAt，不需要）。

### Feature Builder / UI/UX 可直接用

- **Comment doc 形狀最終版**（型別 `Comment` @ `@mango/shared-types`，web 從 `@/lib/types` re-export）：
  `{ commentId, authorUid, authorName, authorPhotoURL(string|null), text, createdAt }`，path `posts/{postId}/comments/{commentId}`。平鋪、v1 不可編輯。
- **Client API**（`apps/web/src/lib/firebase/posts.ts`，已就緒）：
  - `createComment({ postId, authorUid, authorName, authorPhotoURL, text }) → { commentId }`。text 自動 trim；空字串 / 超過 500 字（`COMMENT_MAX_LEN`）會 throw（與 rules 同步，UI 可先本地擋）。`createdAt` server-stamp，optimistic append 請用本地 `new Date()` placeholder，re-read 後換成真值。
  - `deleteComment(postId, commentId)`。rules 允許「留言作者 OR 貼文作者」刪。
  - `listComments(postId, pageSize=20, after?) → { comments, cursor }`：**舊到新**（createdAt 升冪、閱讀順序）、分頁 getDocs（**非 onSnapshot**，對齊成本備註）；`cursor` 傳回下一頁的 `after`，為 `null` 即無更多。
- **commentCount**：直接讀 `post.commentCount`（型別 `Post.commentCount?: number`；**舊貼文可能 undefined → 當 0**）。**前端絕對不要寫它** — 由 function 維護，rules 也不允許 client 寫（避免灌數）。
- **空狀態 / i18n**：UI 自理（「搶頭香留言」等）；後端不涉入文案。

### Push（§C）已上線

- **留言**：`onCommentCreated` → 即時推貼文作者「{name} 留言了你的動態：{摘要}」（摘要上限 60 字；收件人=作者本人，帶摘要安全 = 開放問題#4）。
- **表情**：`onReactionCreated` → **節流/聚合**（開放問題#3 Backend 提案，已實作）：**每貼文 60 分鐘冷卻窗 + leading-edge**。第一個 reaction 立即推；窗內靜默累加；窗結束後第一個 reaction 推一則聚合「{name} 和其他 N 人回應了」。狀態存 server-only `postInteractionThrottle/{postId}`（transaction 並發安全）。**emoji 互換是 update 不是 create → 不重複通知**。**未開新 scheduled function**（成本）。
- **Settings opt-out**：`ENGAGEMENT_PUSH_TYPES` 已加 `post-comment` / `post-reaction`，UI/UX 可在設定頁加兩個開關（沿用現有 engagementOptOut 機制；缺值 = 預設 ON）。

### Rules（已部署）

- 抽出 `canReadPost()` helper；comments read/create 用 `get(父 post)` 沿用貼文可見度（public / friends / 自己）。
- create 守門：`authorUid==auth.uid` + 能讀 post + `text` string 長度 1..500 + `createdAt==request.time`。
- update：v1 `false`（開放問題#1 預設不開放編輯）。delete：留言作者 OR 貼文作者。
- **後端 reaction 模型完全沒動**（`setReaction` / `reactions/{uid}` / `reactionCounts` 原樣）；§B 的 FB 式 picker 純前端互動改版即可。

### 並行備註
- 與 UI/UX session 並行（§B reaction picker commit `35e97a1`）；Backend 只動 `functions/` `firestore.rules` `posts.ts` `types.ts` `shared-types`，未碰 `emoji-reactions.tsx` / `messages/*.json`。兩邊零撞檔。
