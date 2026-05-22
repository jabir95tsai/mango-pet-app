# 家庭 leaderboard 切換

狀態：READY-FOR-DEV
建立日期：2026-05-22
最後更新：2026-05-22
規格作者：PM session @ 3298731

## User Story

作為**家庭成員**，我想在排行榜頁面切換到「家庭內」視圖，因為**我不太在意全 App 陌生人的分數，但很想知道家裡誰最常遛狗、誰是這週的家庭冠軍**。

## 為什麼是現在做

- family Phase 1-4 剛完成（pets / walks / reminders / expenses 全部 migrate 完，attribution UI 上線）— social hook 已經到位
- 家庭內競爭是把「家庭功能」從工具升級為日常使用習慣的最低工入口
- leaderboard 頁已存在（`/app/leaderboard`），週 / 月 / 總榜 tab 已就緒，只是再加一個維度的切換
- 不需要新的 Cloud Function aggregation（家庭通常 < 10 人，可 client-side filter）

## 完成標準

- [ ] 排行榜頁頂部多一個 toggle：「全 App」/「家庭內」(zh-TW) / "All" / "Family" (en)
- [ ] 「家庭內」mode 下：
  - [ ] 只顯示當前 active family 的成員
  - [ ] 週榜 / 月榜 / 總榜三個 tab 都正常運作
  - [ ] 排序仍依 score / distance / duration（沿用現有邏輯）
  - [ ] 名次重新計算（家庭內第 1 名 = 家庭內最高分，不繼承全 App 名次）
- [ ] 使用者**沒有 active family** 時：「家庭內」toggle 顯示但 disabled，hover/tap 提示「先加入或建立家庭」
- [ ] 使用者**有 active family 但只有 1 個成員（只有自己）**：可切換，顯示自己一條，加 empty-state 文案「邀請家人來比一比」
- [ ] 切換後重新整理頁面，停留在上次選的 mode（localStorage 記住）
- [ ] i18n：zh-TW + en 兩個 locale 文案齊
- [ ] Edge case：成員資料還沒載入 → skeleton，不是空白
- [ ] Edge case：成員 leaderboard entry 不存在（沒遛過狗）→ 顯示但分數 0、灰底，不要漏人

## 成功指標（上線後一週看）

- 至少 **2 個家庭**在上線後 3 天內有成員切到「家庭內」tab（從 localStorage key 存在可推測，或加埋點）
- 家庭內排行榜不是 1 個人獨秀（最高分與最低分差 > 0）→ 代表家庭真的有 ≥ 2 人在遛
- 質性：測試家庭（自己 + 家人）回饋「會想再切一次來看本週名次」

## 不在這次範圍

- 跨家庭排行榜（「我家 vs 其他家」）
- 家庭冠軍徽章 / 動效獎勵
- 把「家庭排行榜」資料寫進 Firestore aggregated doc（成員數小，client filter 足夠）
- 改 score 加權公式（公平性問題留給未來，不在這條 spec）
- 推播「本週家庭冠軍」（留給後續 sprint）

## 技術筆記（給 Feature Builder 參考）

- 接近的已實作功能：
  - `src/app/app/leaderboard/page.tsx` — 現有排行榜頁面（週/月/總榜 tab）
  - `src/components/leaderboard/leaderboard-row.tsx` — 列表 row
  - `src/components/family/family-provider.tsx` — 提供當前 family + members 的 context
- 不需要新 collection / 新 cloud function：
  - 沿用 `leaderboards/{period}/entries/{uid}` 拉全部 → client side filter `members.includes(entry.uid)`
- i18n 文案：`messages/en.json` + `messages/zh-TW.json`，建議 key 命名：
  - `leaderboard.scope.all` / `leaderboard.scope.family`
  - `leaderboard.familyEmpty` / `leaderboard.familyOnlyMe`
- 新 type 預估：無
- 新 security rule 需求：無（leaderboard read 規則已存在）
- 新 index 需求：無
- 對 Backend / Migration 的依賴：無

## 開放問題

> Feature Builder 開工前回 PM 確認，這份 spec 接手前要清空

- [ ] 全 App 排行榜目前是否有「資料量太大」分頁問題？如果有，家庭 filter 該前 100 名後 filter 還是先拉全部？（建議：family members 是已知 small set，先 query 各 member uid 直接撈，避開分頁）
- [ ] toggle UI 要 segmented control 還是 tab？（建議 segmented，因為與下方週/月/總榜 tab 視覺區隔）
