# Family Leaderboard 即時更新（real-time）

狀態：**SHIPPED 2026-05-25**（3 commits `bf8ed08` → `1245286` → `4edb873`；deploy 完成 rules + functions:recomputeWalkerLeaderboards,aggregateLeaderboards；App Hosting 自動 build frontend）
建立日期：2026-05-25
最後更新：2026-05-25
規格作者：PM session @ `b6e781d`
角色：**Feature Builder**（server-side onCreate trigger + frontend listener + UI glow + i18n 不需）
工作量：**S-M**

## SHIPPED bookkeeping

- `bf8ed08` refactor(leaderboard): extract computeWalkerPeriodScore shared helper
  - 新 `functions/src/leaderboard-helpers.ts` 匯出 `computeWalkerPeriodScore(walkerUid, period, db, now?)` + `UserAccum` + `periodStartMs`
  - `aggregateLeaderboards` 改用 helper（先 collectionGroup 拿 unique walker uids，每人 3 個 period 並行算）
  - Personal-mode filter (`familyId == null` → skip) 移到 helper 內
  - 既有 `(walkerUid ASC, familyId ASC, startedAt DESC)` 複合索引 cover helper 查詢
- `1245286` feat(leaderboard): recomputeWalkerLeaderboards onCreate trigger + audit + lastUpdatedAt
  - 新 `recomputeWalkerLeaderboards` onCreate(`walks/{walkId}`) trigger（並列 `familyGoalMilestone`）
  - `writeSingleLeaderboardEntry` 用 `merge:true`，不動 `previousRank`（B1 push 邏輯保留）
  - `LeaderboardEntry.lastUpdatedAt?: Timestamp` 新欄位；cron + trigger 都寫
  - `realtimeLeaderboardUpdates/{walkerUid}_{ISO}` audit collection；rules admin/server-only
- `4edb873` feat(leaderboard): client listener glow animation + reduced-motion skip
  - `subscribeLeaderboard()` 用 `onSnapshot` 取代 `getDocs`
  - `useLeaderboardEntryGlow` hook (`src/components/leaderboard/use-glow.ts`)：mount-baseline pass 不 glow；FRESH_WINDOW_MS=5s 過濾掉 cron 寫入（user 通常 00:30 不在看）
  - `LeaderboardRow.isGlowing` prop → `.leaderboard-row-glow` className
  - `@keyframes leaderboardGlow`（rgba(243,152,0,0.18) peak, 1.5s, ease-out）+ explicit `animation:none` for reduced-motion audience

### 後續驗證 / 觀察

- 雙瀏覽器 test（user A leaderboard / user B walks）等 PM/user 實機跑
- `realtimeLeaderboardUpdates/*` doc 可在 Firebase Console 直接查（grep walker_uid_2026-05-25T*）
- 明天 00:30 cron 自動跑一次 reconciliation — 觀察 entries 值是否跟 realtime trigger 寫的最後值一致

### 已知議題（PM 收尾 backlog 候選）

- Mid-session staging slip：`d07511c` commit 訊息誤掛 `feat(leaderboard)` 但內容是 `/join` redirect 修復（先前 session 遺留 working tree）。實際 commit 2 是 `1245286`。歷史 cosmetic 髒，不影響功能。建議下次 commit / PR 時用 `git status` 確認 staged 內容。

## User Vision（原話保留）

> 「將家庭內的遛狗排行榜即時更新」

## 3 個 decisions（confirmed）

| # | Decision | Final | 註 |
|---|---|---|---|
| **D1** ✅ | 即時範圍 | **只 family 內 view** 即時 | global weekly/monthly/all_time 繼續走 daily cron，避免成本爆炸 |
| **D2** ✅ | 實作機制 | **Server-side walks onCreate trigger**（同 Epic 5 B2 pattern）| Authoritative 寫進 leaderboards/* doc → Firestore real-time listener 自動推給 client，1-2s latency |
| **D3** ✅ | UI 動畫 | **新分數 brand color glow 1.5s** | medium 動效跟 walks v2 一致；prefers-reduced-motion skip |

## 背景

- `aggregateLeaderboards` daily 00:30 Asia/Taipei cron 是 authoritative source
- 家庭成員遛狗結束 → 最壞 case 24h 後才在 leaderboard 上榜（user 痛點）
- Epic 5 B1 rank-overtake push 依賴 leaderboard data — 本 spec 不改 B1 計算邏輯
- Epic 5 B2 family-milestone 已建立 `walks onCreate` event trigger pattern — 本 spec 加 sibling trigger，並列各跑各

## 完成標準

### Server-side（functions/src/index.ts）

- [ ] **抽 helper**：`functions/src/leaderboard-helpers.ts` 新檔，匯出 `computeWalkerPeriodScore(walkerUid, periodKey, db)` — 給 daily cron + realtime trigger **重用**
  - 從既有 `aggregateLeaderboards` 內擷取 walker 單人 score 計算邏輯
  - Personal-mode filter (`familyId === null` → skip) 含在 helper 內
- [ ] **新 trigger**：`recomputeWalkerLeaderboards` onCreate(`walks/{walkId}`)：
  - 從 walk doc 拿 walkerUid
  - 用 helper 算 walker 的 weekly + monthly + all_time score
  - 寫到 `leaderboards/{periodKey}/entries/{walkerUid}` 三個 doc，含 **新欄位 `lastUpdatedAt: serverTimestamp()`**（給 client glow 用）
  - 沿用既有 ranking schema（previousRank 已加給 B1 用 — 不動）
  - 不重算其他 family member（他們自己遛狗時才更新自己的 entry）
  - **不發 push**（B1/B2 既有 push 邏輯不變）
- [ ] **Audit doc**：`realtimeLeaderboardUpdates/{walkerUid}_{ISO}` 紀錄觸發時間 + walkId + 算到的 weekly/monthly/all-time 分數
  - 同 Epic 5 audit collection pattern；rules: admin/server-only write
- [ ] **既有 daily cron `aggregateLeaderboards` 改用同 helper** — 確保兩條 path 算出來的值一致；不改 cron schedule，仍 00:30 跑作 authoritative reconciliation

### Schema

- [ ] `leaderboards/{period}/entries/{uid}.lastUpdatedAt?: Timestamp` 新 optional 欄位
  - Daily cron 寫入時也帶（reconciliation 把 realtime trigger 寫的時間覆蓋成 cron 跑的時間 — 不影響 glow，因為 cron 跑時 user 通常不在看）
- [ ] `realtimeLeaderboardUpdates/{document=**}` 新 collection — rules admin/server-only

### Frontend

- [ ] `src/app/app/leaderboard/page.tsx`（或對應元件）：
  - 確認已用 `onSnapshot` Firestore listener（如果還是 `getDocs` 改成 listener）
  - Listener 監聽 family 內成員的 entries（query: `where("uid", "in", familyMemberUids)` 或既有 family-scope 查詢）
- [ ] **新 hook** `useLeaderboardEntryGlow(entries)` in `src/components/leaderboard/use-glow.ts`：
  - 比較前後兩次 `entries` snapshot 的 `lastUpdatedAt`
  - 哪個 uid 的 lastUpdatedAt 變新（且差異 < 5 秒）→ 進 glow set
  - 1.5s 後從 glow set 移除
  - Return: `Map<uid, boolean>`
- [ ] **Row 元件改 / 新元件**：leaderboard row 接 `isGlowing: boolean` prop → 條件加 className `leaderboard-row-glow`
- [ ] **CSS**：`src/app/globals.css` 加 keyframe（or scope 在 component style）：
  ```css
  @keyframes leaderboardGlow {
    0% { background-color: rgba(var(--mango-brand), 0); }
    20% { background-color: rgba(var(--mango-brand), 0.18); }
    100% { background-color: rgba(var(--mango-brand), 0); }
  }
  .leaderboard-row-glow { animation: leaderboardGlow 1.5s ease-out; }
  @media (prefers-reduced-motion: reduce) {
    .leaderboard-row-glow { animation: none; }
  }
  ```

### i18n

- [ ] **無需新 key**（純動畫，無文字變化）

### 護欄

- [ ] 不動 `aggregateLeaderboards` cron schedule（仍 00:30 daily）— 改 helper 重用是 refactor，行為等價
- [ ] 不動 Epic 5 B1 rank-overtake push 邏輯（仍每日 00:30 算 diff）
- [ ] 不動 Epic 5 B2 family-milestone trigger（並列新 trigger）
- [ ] 不動 personal-mode filter（personal walks 仍不計分 — helper 內 cover）
- [ ] 不動 mango tokens
- [ ] 不引入新 dependencies / animation library
- [ ] 不發新 push（leaderboard 變化純視覺反饋）

### 預驗收 checklist

- [ ] `npx tsc --noEmit` pass（functions + frontend）
- [ ] Chrome MCP 雙瀏覽器 test：
  - User A 在瀏覽器 1 開 `/app/leaderboard`
  - User B（同 family）在瀏覽器 2 完成 walk
  - User A 1-2s 內看到 B 的 row 分數更新 + brand glow 1.5s
- [ ] 自己遛狗結束 → 回 `/app/leaderboard` 看自己 row 也 glow（如剛好開著頁面 + 1-2s 內回到 leaderboard）
- [ ] Personal-mode 用戶遛狗 → leaderboard 完全不變（既有行為保留）
- [ ] Daily cron 00:30 仍跑 — 第二天 entries 值跟 realtime 寫入的最後值一致（reconciliation 對齊）
- [ ] reduced-motion 用戶：row 仍更新數字但無 glow animation
- [ ] Functions deploy: `npx firebase deploy --only functions:recomputeWalkerLeaderboards,aggregateLeaderboards`（後者要重 deploy 因為改用新 helper）

## 不在範圍

- Global all_time / weekly / monthly 即時更新（仍走 daily cron）
- B1 rank-overtake push 改即時觸發（仍 daily diff — 每日推一次設計刻意 throttle 避免疲勞）
- Leaderboard row 換位 animation（如 user 從 #3 升到 #2 時 row 飛過去）— 工作量大，下波 polish
- 即時 family 排名變化 push（「{X} 即時超越你了」即時推）— 高度可能過擾
- 多 family（user 同時在多 family）即時 view 切換動畫
- Realtime leaderboard 在 walks page hero / 其他頁面顯示

## Edge cases

| Case | 處理 |
|---|---|
| Walker 同時遛多次（rapid walks）| 每 onCreate 都 trigger，覆蓋寫入；最後一筆 lastUpdatedAt 獲勝；glow 對 user 視覺上只看到 1 次（合併效果）|
| Personal-mode walker | Helper 內 skip — 同既有 aggregateLeaderboards 行為 |
| Family 只有 user 自己 | trigger 仍跑寫入，但沒其他 viewer；無害；自己看自己 row 仍 glow |
| 同 family 多人同時遛狗 | 各自的 onCreate trigger 並行；各自寫各自 entry doc，不衝突 |
| Listener 第一次 mount 拿到 entries | useGlow 第一次 snapshot 不算「新」(無 baseline)，不 glow — 避免進頁面就一堆 glow |
| Walker 遛完但網路差 walk doc 寫入慢 | Trigger 等 walk doc commit 才跑；user 體驗一致（看到 walk 上去後 1-2s glow）|
| Daily cron 跟 realtime trigger race | Cron 跑時若 entry 剛被 trigger 寫過，cron 寫入覆蓋（authoritative，值幾乎相同）— acceptable |
| Walk 被刪 | 不在本 spec — daily cron 隔天 reconcile；realtime 不處理 delete（避免複雜化）|
| Browser tab 在 background | onSnapshot 仍跑；user 切回時看到 glow 已結束 — acceptable（user 不在看也沒影響）|
| Entry 不存在（新 user 第一次遛狗）| trigger 寫入時用 `set` 不是 `update`，create 新 doc — 沒問題 |

## 跟其他 spec 的關聯

- **family-leaderboard.md**：本 spec 補充其 daily cron 不夠即時的痛點；無 schema 衝突
- **engagement-push-notifications.md (Epic 5 B1)**：B1 push 依然走 daily aggregateLeaderboards 後 diff，**本 spec 不影響 B1 觸發邏輯**（B1 是日級 push，realtime UI 是頁級反饋，兩件事）
- **engagement-push-notifications.md (Epic 5 B2)**：B2 family-milestone 也用 walks onCreate trigger；**本 spec 新 trigger 並列**，無互相依賴，部署順序自由
- **walks-v2-rebuild.md (Phase 1 v2)**：無關聯（visual rebuild，不動 leaderboard 邏輯）
- **photo-lightbox.md**：無關聯
- **未來「leaderboard row 換位 animation」follow-up**：本 spec 把 lastUpdatedAt schema 預埋，未來 follow-up 可加 rank diff animation

## PM 觀察

工作量小 — **1 個新 trigger function + helper extraction + frontend listener tweak + 1 個 CSS keyframe**。建議 Feature Builder 一個 session 內 ship，拆 3 個 commit：

1. `refactor(leaderboard): extract computeWalkerPeriodScore shared helper（aggregateLeaderboards 內邏輯抽出 + cron 改用）`
2. `feat(leaderboard): recomputeWalkerLeaderboards onCreate trigger + audit doc + lastUpdatedAt schema`
3. `feat(leaderboard): client listener glow animation + reduced-motion skip`

部署順序：先 deploy schema + rules（lastUpdatedAt 欄位 + realtimeLeaderboardUpdates audit collection），再 deploy functions（trigger + cron refactor），最後 push frontend（glow animation）。

## Launch prompt（user 開 Feature Builder session copy 用）

```
本 session 固定角色：Feature Builder — server-side walks onCreate trigger + frontend
glow animation 讓家庭排行榜即時更新。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/family-leaderboard-realtime.md（PM 寫好，含完成標準 + 護欄 + edge cases）
- 既有 cron 邏輯參考：functions/src/index.ts 內 aggregateLeaderboards（line 316+）+
  writeLeaderboardWithRanks（line 254+）— 你會抽 helper 從這
- 既有 onCreate pattern 參考：Epic 5 B2 family-milestone trigger（commit 40a7e02）
- 既有 leaderboard frontend: src/app/app/leaderboard/page.tsx + 相關元件
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4
- 必讀 functions/AGENTS.md 如有

護欄
- 動 functions/src/index.ts + 新 functions/src/leaderboard-helpers.ts OK
- 動 firestore.rules（加 realtimeLeaderboardUpdates audit）OK
- 動 src/app/app/leaderboard/page.tsx + src/components/leaderboard/* OK
- 動 src/lib/types.ts 加 LeaderboardEntry.lastUpdatedAt?: Timestamp OK
- 動 src/app/globals.css 加 leaderboardGlow keyframe OK（這個視覺 global 合理）
- 不動 aggregateLeaderboards cron schedule（保留 00:30 daily 當 authoritative）
- 不動 Epic 5 B1 rank-overtake push 邏輯
- 不動 Epic 5 B2 family-milestone trigger
- 不動 personal-mode filter 行為
- 不引入新 dependencies / animation library

實作順序
1. Refactor: 抽 computeWalkerPeriodScore helper（aggregateLeaderboards 改用，行為等價驗證）
2. New trigger: recomputeWalkerLeaderboards onCreate(walks/{walkId})
3. Schema: LeaderboardEntry 加 lastUpdatedAt?: Timestamp（type + rules + cron 寫入）
4. Frontend: useLeaderboardEntryGlow hook + glow className 接到 row 元件
5. CSS: leaderboardGlow keyframe + reduced-motion skip
6. Audit: realtimeLeaderboardUpdates collection

預驗收（spec 內 checklist 跑完）
- npx tsc --noEmit pass（functions + frontend）
- 雙瀏覽器 test：家人遛狗 → 對方 leaderboard view 1-2s glow
- Personal walks 仍不上榜
- Daily cron 隔天 reconcile 值一致
- reduced-motion stops glow
- Functions deploy: npx firebase deploy --only functions:recomputeWalkerLeaderboards,aggregateLeaderboards

commit 拆解
1. refactor(leaderboard): extract computeWalkerPeriodScore shared helper
2. feat(leaderboard): recomputeWalkerLeaderboards onCreate trigger + audit + lastUpdatedAt
3. feat(leaderboard): client listener glow animation + reduced-motion skip

回報格式
- 每 commit hash + 1 行 review note
- 全部 ship 後 summary 給 PM 收尾 roadmap

開工。
```
