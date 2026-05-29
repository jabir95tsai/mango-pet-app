# 家庭 leaderboard 切換

狀態：**SHIPPED 2026-05-23**（Phase 0 `32c4feb` + scope/personal-mode UI `37ac063`；realtime follow-up later shipped in `family-leaderboard-realtime.md`）
建立日期：2026-05-22
最後更新：2026-05-29 PM audit sync
規格作者：PM session @ 3298731；2026-05-23 update by PM @ 7f8c97d
角色：Feature Builder（整 stack — 含 functions/src/index.ts 的 prereq fix）

## User Story

作為**家庭成員**，我想在排行榜頁面切換到「家庭內」視圖，因為**我不太在意全 App 陌生人的分數，但很想知道家裡誰最常遛狗、誰是這週的家庭冠軍**。

並且：**personal mode 使用者（沒家庭）不該看到陌生人 leaderboard，也不該被擋在頁外** — 顯示清楚的 empty state + CTA。

## 為什麼是現在做

- family Phase 1-4 已 ship + personal mode 也 ship — 兩個 mode 並存的時刻
- 家庭內競爭是把「家庭功能」從工具升級為日常使用習慣的最低工入口
- leaderboard 頁已存在（`/app/leaderboard`），週 / 月 / 總榜 tab 已就緒，只是再加一個維度的切換
- mobile bottom nav 重組剛把 leaderboard 升為 primary nav — personal user 也會點到，必須處理好 personal mode 體驗
- 不需要新的 Cloud Function aggregation（家庭通常 < 10 人，可 client-side filter）

## Phase 0: Prerequisite（先做）— aggregateLeaderboards filter personal walks

**動工此 spec 前必做**，否則 personal mode 使用者的 walks 會洩漏進全 App leaderboard。

對應 backlog 條目「Personal walks 不應進全 App leaderboard」（已升級到本 spec，backlog 條目可標 resolved）。

### 改動

- `functions/src/index.ts` 的 `aggregateLeaderboards` 改 collectionGroup query 加 filter：`where("familyId", "!=", null)`
- 確認 `firestore.indexes.json` 對應 collectionGroup index 仍能 serve 這個 inequality filter（可能需要新 composite index — 由 FB 觀察 Firestore 錯誤訊息決定）
- 部署順序：先 indexes（等 BUILT）→ functions → 跑一次 manual trigger 或等下次每日 00:30 排程
- 驗證：personal mode 帳號跑 walks → 等下次 aggregateLeaderboards → 確認 `leaderboards/{period}/entries/{personalUid}` **不存在** / 該 personal user 的 walks 沒被算分

### 為什麼不另開短 spec

- FB 整 stack 角色允許動 `functions/src/index.ts`
- 改動 1 條 query line，跟 #3 主體相關（personal walks 不入 leaderboard 是 #3 personal-mode 行為的 server-side 配套）
- 兩件事一起 ship 比較乾淨

## 完成標準（含 personal mode 全新行為）

### A. Family mode 行為（已有家庭使用者）

- [ ] 排行榜頁頂部多一個 toggle：「全 App」/「家庭內」(zh-TW) / "All" / "Family" (en)
- [ ] 「家庭內」mode 下：
  - [ ] 只顯示當前 active family 的成員
  - [ ] 週榜 / 月榜 / 總榜三個 tab 都正常運作
  - [ ] 排序仍依 score / distance / duration（沿用現有邏輯）
  - [ ] 名次重新計算（家庭內第 1 名 = 家庭內最高分，不繼承全 App 名次）
- [ ] 使用者**有 active family 但只有 1 個成員（只有自己）**：可切換，顯示自己一條，加 empty-state 文案「邀請家人來比一比」
- [ ] 切換後重新整理頁面，停留在上次選的 mode（localStorage 記住）

### B. Personal mode 行為（**新加，2026-05-23**）

- [ ] **沒有任何 active family 的使用者**進 `/app/leaderboard`：
  - [ ] **不顯示** toggle（無家庭可切，toggle 沒意義）
  - [ ] **不顯示** 全 App leaderboard rows（personal walks 不入 aggregation，看 ranking 也沒意義）
  - [ ] 顯示明確 empty state：
    - 標題：「加入家庭看排行榜」/「Join a family to see leaderboards」
    - 副標：「排行榜目前只給家庭內互比 — 自己一個人時看自己 stats 才有意義」/「Leaderboards work within families. For just-yourself stats, your home page already covers it.」
    - CTA button：「建立 / 加入家庭」→ 跳 `/onboarding`
  - [ ] **不顯示** 週/月/總榜 tab（無 leaderboard 可顯示，tab 沒意義）
- [ ] Edge case：使用者剛離開所有家庭 → 立即進 personal mode 行為，不顯示老資料

### C. 共用（family + personal）

- [ ] i18n：zh-TW + en 兩個 locale 文案齊
- [ ] Edge case：成員資料還沒載入 → skeleton，不是空白
- [ ] Edge case：成員 leaderboard entry 不存在（沒遛過狗）→ 顯示但分數 0、灰底，不要漏人

## 成功指標（上線後一週看）

- 至少 **2 個家庭**在上線後 3 天內有成員切到「家庭內」tab
- 家庭內排行榜不是 1 個人獨秀（最高分與最低分差 > 0）
- 質性：測試家庭（自己 + 家人）回饋「會想再切一次來看本週名次」
- Personal mode 使用者進 leaderboard 看到 empty state + CTA，**不感覺被拒於門外**
- `leaderboards/{period}/entries/*` 內**沒有** `familyId == null` 的使用者（aggregateLeaderboards filter 生效）

## 不在這次範圍

- 跨家庭排行榜（「我家 vs 其他家」）
- 家庭冠軍徽章 / 動效獎勵
- Personal mode 使用者的「個人 stats card」（distance / streak 等）— 另開 spec 如有需求
- 把「家庭排行榜」資料寫進 Firestore aggregated doc（成員數小，client filter 足夠）
- 改 score 加權公式
- 推播「本週家庭冠軍」

## 技術筆記（給 Feature Builder 參考）

### 動到的檔案

- `functions/src/index.ts`：`aggregateLeaderboards` 加 `familyId != null` filter（Phase 0）
- `firestore.indexes.json`：可能新 collectionGroup composite index（看 Firestore 錯誤訊息）
- `src/app/app/leaderboard/page.tsx`：加 toggle UI + family / personal mode 分支
- `src/components/leaderboard/leaderboard-row.tsx`：可能不動，沿用
- `src/components/family/family-provider.tsx`：useFamily() 取 current family + members
- `messages/zh-TW.json` + `messages/en.json`：新 i18n key

### i18n key 建議

- `leaderboard.scope.all` / `leaderboard.scope.family`
- `leaderboard.familyOnlyMe`（家庭只有 1 人）
- `leaderboard.personalEmpty.title` / `leaderboard.personalEmpty.subtitle` / `leaderboard.personalEmpty.cta`（personal mode empty state）

### 不需動

- schema、rules、index（除非 Firestore 要新 composite）
- 新 collection
- 新 callable

### 部署順序

1. `npx firebase deploy --only firestore:indexes`（若需新 index）
2. `npx firebase deploy --only functions:aggregateLeaderboards`（Phase 0）
3. `git push origin main`（前端 UI 最後）

## 開放問題

- [x] 全 App 排行榜目前是否有「資料量太大」分頁問題？建議：family members 是已知 small set，先 query 各 member uid 直接撈，避開分頁
- [x] toggle UI：採 segmented control（與下方週/月/總榜 tab 視覺區隔）
- [x] Personal mode 行為：採「empty state + CTA 進 onboarding」（不顯示 toggle / 不顯示 ranking / 不顯示 tab）
