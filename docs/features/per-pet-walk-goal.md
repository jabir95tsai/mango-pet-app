# Per-pet 自訂散步目標（per-pet walk goal）

狀態：**GO**（user 2026-05-25 中午 3 個 decisions confirmed）
建立日期：2026-05-25
最後更新：2026-05-25
規格作者：PM session @ `fbadd50`
角色：**Feature Builder**（整 stack — schema + Pet edit UI + walks page pet picker + push functions cascade + i18n）
工作量：**M-L**（跨 4 surface：pets edit / walks page picker / push functions / leaderboard 確認）

## User Vision（原話保留）

> 「加上可自訂散步目標的功能，在我的寵物裡面編輯，之後會依照不同品種年齡體重計算目標」

## 3 個 decisions（confirmed）

| # | Decision | Final | 註 |
|---|---|---|---|
| **D1** ✅ | Goal 維度 | **只分鐘**（對齊現有 30 min hardcode） | 簡化 + 對齊既有 push / dial / leaderboard 計算邏輯 |
| **D2** ✅ | 多 pet 套用 | **walks page 加 pet picker**，user 選哪隻 pet 的 goal | user 改 PM default — 啟用 Phase 1 v2 原 DEFERRED 的「多 pet picker UX」chevron-down |
| **D3** ✅ | Future breed/age/weight | **只預留 schema namespace**，本輪純 manual override | Pet.walkGoal.source 預留 `'manual'` / `'computed'`；本 spec 全寫 'manual'；future spec 加 computed helper |

## 背景

- 現有「每日 30 分鐘」是全 app hardcode（walks page dial / week strip / A1 push / A2 streak / B2 family-milestone push）
- Phase 1 v2 walks page 已 ship：top-bar Mango pill chevron-down 是 no-op + aria 標「多 pet 支援開發中」
- Phase 2 pets v2 spec 已開：PetHeader 含 pencil edit button → 本 spec 加 walkGoal 欄位進去
- Per-pet goal 解鎖 Phase 1 v2 原 DEFERRED 的多 pet picker UX

## 完成標準

### Schema

- [ ] `src/lib/types.ts`：
  - `Pet.walkGoal?: { minutes: number; source: 'manual' | 'computed' }` 新 namespace
  - 本輪 source 全寫 `'manual'`；future spec 加 `'computed'` formula helper 時不衝突
- [ ] `firestore.rules`：Pet.walkGoal 寫入規則跟 Pet.name 同（owner / family member 可寫）
- [ ] 既有 pet 沒 walkGoal → 視為 `{ minutes: 30, source: 'manual' }` (default fallback 在 helper 內 cover)
- [ ] 新 constant `DEFAULT_WALK_GOAL_MINUTES = 30` in `src/lib/walk-goals.ts`（給 fallback 用）

### Helper

- [ ] `src/lib/walk-goals.ts`（新檔）：
  - `getPetWalkGoalMinutes(pet: Pet): number` — return `pet.walkGoal?.minutes ?? DEFAULT_WALK_GOAL_MINUTES`
  - `formatWalkGoal(minutes: number, t): string` — i18n-aware「{n} 分鐘 / 天」
  - Future placeholder: `computeWalkGoalFromBreed(pet)` — 本輪不實作，留 TODO 註解 + JSDoc 寫 future spec link

### Frontend — Pet edit UI

- [ ] `src/components/pets/pet-walk-goal-input.tsx`（新檔）：
  - Label「每日散步目標」+ stepper input（5 min step，min 5 / max 180）
  - Hint「之後可依品種、年齡、體重自動建議」(grayed-out future hint)
  - 顯示 `source === 'computed'` 時 chip「建議值（可覆蓋）」（本輪不會出現，預埋 UI）
- [ ] 整合進 pet edit form：
  - 若 pets v2 已 ship → 整合進 pet detail page 的 pencil edit button 對應 form
  - 若 pets v2 未 ship → 整合進現有 pet edit page / modal (src/app/app/pets/* 對應 form 元件)
  - Save button 寫進 `pet.walkGoal = { minutes: input, source: 'manual' }`
- [ ] `src/lib/firebase/pets.ts`：`updatePetWalkGoal(petId, minutes)` helper

### Frontend — Walks page pet picker（**解鎖 Phase 1 v2 原 DEFERRED**）

- [ ] `src/components/walks/pet-picker-dropdown.tsx`（新檔）：
  - 從 Phase 1 v2 既有 top-bar Mango pill chevron-down tap 開啟
  - Dropdown panel 列各 pet：avatar + name + 「{goal} 分/天」chip
  - Active pet 打勾 brandDeep
  - 底部「管理寵物」row → 連到 `/app/pets`
  - Click outside / Esc 關閉
- [ ] `src/app/app/walks/page.tsx`：
  - State: `activePetId` (預設 = lastPetId localStorage 或 主寵物 createdAt 最早)
  - Top-bar Mango pill 改顯示 activePet 名字 + chevron-down 啟用
  - WalksDial 用 `getPetWalkGoalMinutes(activePet)` 替代 hardcoded 30
  - Hero copy「再走 {goalMin - doneMin} 分鐘」→ 用 activePet goal
  - Week strip 達標 boolean: `dayTotal >= getPetWalkGoalMinutes(activePet)`
  - 切換 pet → localStorage.setItem('lastPetId', newPetId) + 重 render
- [ ] 移除 Phase 1 v2 chevron-down aria「多 pet 支援開發中」標籤
- [ ] 單 pet user：chevron-down 隱藏（保持單 pet user UX 不破）

### Cloud Functions — Push 邏輯 cascade

- [ ] `functions/src/index.ts`：
  - 新 helper `getPetWalkGoalMinutes(pet, defaultMin=30)` 在 functions 端（不能 import src/，shared logic 內聯）
  - `eveningWalkReminder` (A1)：改用 user **主寵物**（createdAt 最早 pet）的 walkGoal.minutes，未達就推
  - `streakBreakWarning` (A2)：仍用 walks count === 0 條件（不依賴 goal — 「沒遛」就斷 streak），**本 spec 不改 A2 邏輯**
  - `familyGoalMilestone` (B2)：改用 walker 主寵物的 walkGoal.minutes 作為 threshold（取代 hardcoded 30）
  - **保守：multi-pet user 仍只看主寵物 goal**（避免每隻 pet 各推一次 → user 被轟炸）
  - 未來多 pet picker UX 成熟後可改 per-pet push（follow-up spec）

### Leaderboard

- [ ] **無需改動** — leaderboard scoring 是 raw 累積 minutes（不是 goal-based），改 goal 不影響排名
- [ ] `aggregateLeaderboards` + `recomputeWalkerLeaderboards`（Family Leaderboard 即時更新 spec ship 的）都不動

### i18n

- [ ] `messages/zh-TW.json` + `messages/en.json` 新 keys：
  - `PetEdit.walkGoal.label`（「每日散步目標」/「Daily walk goal」）
  - `PetEdit.walkGoal.unit`（「分鐘 / 天」/「min/day」）
  - `PetEdit.walkGoal.hint`（「之後可依品種、年齡、體重自動建議」/「Will suggest based on breed/age/weight later」）
  - `PetEdit.walkGoal.computedChip`（「建議值（可覆蓋）」/「Suggested (overridable)」— 本輪未用，預埋）
  - `WalksPage.petPicker.manageLink`（「管理寵物」/「Manage pets」— dropdown 底部 row）
  - `WalksPage.petPicker.goalChip`（「{n} 分/天」/「{n} min/day」）

### 護欄

- [ ] 不動 Pet.name / Pet.breed / Pet.age / Pet.weight 等既有 schema
- [ ] 不動 walks logic (start/stop/GPS/Wake Lock)
- [ ] 不動 walk-tracking-view tracking / done screen 結構
- [ ] 不動 mango tokens
- [ ] 不引入新 input / dropdown library
- [ ] 不動 leaderboard scoring 邏輯（goal 不影響分數）
- [ ] A2 streak warning push 不改（streak 條件跟 goal 解耦）
- [ ] Functions 用內聯 helper（不能 cross-import src/lib/）
- [ ] Default 30 min fallback 在所有 read site 都 cover（避免 nil pointer）

### 預驗收 checklist

- [ ] `npx tsc --noEmit` pass（functions + frontend）
- [ ] Pet edit：
  - 設 walkGoal = 45 → save → Firestore Pet doc 寫入 `{ minutes: 45, source: 'manual' }`
- [ ] Walks page 單 pet user：
  - Dial 顯示 45 / 天目標
  - Hero「再走 X 分鐘」算對
  - Week strip 達標條件 = 45 分
  - chevron-down 隱藏（單 pet）
- [ ] Walks page 多 pet user：
  - chevron-down 啟用 → 點開 dropdown 列各 pet + goal chip
  - 切 pet → dial 換 goal + lastPetId 寫 localStorage
  - 重新進頁 → 自動套上次選的 pet
- [ ] A1 push：晚上 20:00 cron，主寵物 walkGoal.minutes = 45，今日 walks total < 45 → 推
- [ ] B2 push：家人完成主寵物 45 min → 推給其他家人
- [ ] A2 streak warning：仍 streak ≥ 3 + 今日 0 walks 才推（goal 無關）
- [ ] Leaderboard：scoring 不變
- [ ] Existing user 沒 walkGoal → 自動 default 30 min（與 ship 前行為等價）
- [ ] commit message: `feat(pets): per-pet walk goal + walks pet picker + push cascade`
- [ ] Deploy: `npx firebase deploy --only functions:eveningWalkReminder,familyGoalMilestone` + push frontend

## 不在範圍

- **Breed/age/weight 自動計算 goal**（future spec — schema 已預埋 source: 'computed'）
- **Goal recommendation UI**（「建議 30 分鐘 / 中型犬」chip — future）
- **Per-pet push opt-out**（quiet hours / per-pet — engagement-push spec follow-up）
- **多 pet picker 進階 UX**（如 walks page 同時顯示多 pet progress）— 本 spec 只實作 single active pet picker
- **Multi-pet per-pet push**（A1/B2 每隻 pet 各推一次）— 本 spec 保守只主寵物，避免轟炸
- **Goal history / changelog**（user 改過幾次 goal）
- **Goal 單位 km / 次數**（D1 user 選只分鐘）
- **Goal sync 跨家庭成員**（每隻 pet 一個 goal，所有家人共用 — schema 已 cover）

## Edge cases

| Case | 處理 |
|---|---|
| Pet 沒 walkGoal | Fallback `{ minutes: 30, source: 'manual' }`（helper 內 cover）|
| Pet walkGoal.minutes 超 range | UI input 限 5-180，外部寫入 (e.g., direct Firestore) → 渲染時 clamp 顯示 |
| 單 pet user | walks page chevron-down 隱藏（保持單 pet UX 簡潔）|
| 多 pet user 選的 pet 被刪 | lastPetId 失效 → 自動 fallback 到主寵物（createdAt 最早）|
| 家庭多人改同 pet walkGoal | 最後一次寫贏（家人共用 pet，不衝突）|
| Pet walkGoal 改了但 walks page 已開著 | onSnapshot 自動更新 dial（既有 Firestore listener）|
| A1 push 跑時 user 沒主寵物 | 既有 logic skip（無 pet 不推）|
| Personal mode user 0 pets | 同上 skip |
| Goal 改後既有達標 walks 怎算 | Week strip 重算每日達標 boolean（不存歷史快照）— 改了後過去某天可能從 ✅ 變 ❌（acceptable，user 改 goal 是自願）|
| Future 加 'computed' source | UI 自動顯示「建議值（可覆蓋）」chip；本 spec 預埋 i18n key |

## 跟其他 spec 的關聯

- **walks-v2-rebuild.md (Phase 1 v2)**：本 spec **啟用** Phase 1 v2 原 DEFERRED 的 chevron-down picker UX；walks page dial / week strip / hero copy 改用 activePet goal 取代 hardcode；不破其他結構
- **pets-v2-rebuild.md (Phase 2 v2)**：pet edit form 加 walkGoal input；若 pets v2 先 ship 用 PetHeader pencil edit；若本 spec 先 ship 用現有 pet edit page
- **engagement-push-notifications.md (Epic 5)**：
  - A1 evening reminder：threshold 從 30 改用主寵物 walkGoal.minutes
  - A2 streak warning：**不改**（streak 條件跟 goal 解耦）
  - B2 family-milestone：threshold 從 30 改用 walker 主寵物 walkGoal.minutes
  - B1 rank-overtake：無關（不依 goal）
- **family-leaderboard-realtime.md**：無關聯（leaderboard scoring 不依 goal）
- **walks-auto-photo-share.md**：無關聯（auto photo 不依 goal threshold）
- **photo-lightbox.md**：無關聯
- **未來 breed-based computed goal spec**：本 spec 預留 `source: 'computed'` namespace 給 future 用

## PM 觀察

工作量 M-L 跨 4 surface — 但 schema + helper 簡單，主要時間在：
- 多 pet picker dropdown UX（之前 DEFERRED 解鎖，現要做）
- 確保 push functions 端 cascade 對齊（不能 cross-import src/lib，要內聯 helper）
- pet edit form 整合（看 pets v2 是否先 ship 影響 UX 入口）

**建議 Feature Builder 1-2 個 session 內 ship**，拆 commit：

1. `feat(types): Pet.walkGoal schema + getPetWalkGoalMinutes helper + DEFAULT_WALK_GOAL_MINUTES`
2. `feat(pets): pet-walk-goal-input 元件 + 整合進 pet edit form + updatePetWalkGoal helper`
3. `feat(walks): pet-picker-dropdown 元件 + walks page 啟用 chevron-down + activePet state + lastPetId localStorage`
4. `feat(walks): walks-dial / week-strip / hero copy 改用 activePet goal`
5. `feat(push): A1 + B2 functions 改用 walker 主寵物 walkGoal.minutes（A2 不動）`
6. `chore(i18n): PetEdit.walkGoal.* + WalksPage.petPicker.* keys (zh-TW + en)`

部署順序：先 deploy schema + rules → 再 deploy frontend (pets edit + walks picker) → 最後 deploy functions（A1/B2 push cascade）。

**Ship 後 PM 收尾 roadmap**：
- 本 spec 標 SHIPPED
- walks-v2-rebuild.md 加 note「Phase 1 v2 原 DEFERRED chevron-down 已 unlock（per-pet-walk-goal spec ship）」
- pets-v2-rebuild.md 加 note「PetHeader pencil edit form 含 walkGoal input」
- 想做還沒規格：加「breed/age/weight 自動計算 goal」(future)

## Launch prompt（user 開 Feature Builder session copy 用）

```
本 session 固定角色：Feature Builder — per-pet 自訂散步目標 + walks pet picker + push cascade。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/per-pet-walk-goal.md（PM 寫好，含 schema + 4 surface 完成標準 + 護欄 + edge cases + i18n keys）
- 既有 walks page: src/app/app/walks/page.tsx（Phase 1 v2 SHIPPED — chevron-down 目前 no-op，你會啟用）
- 既有 walks 元件: src/components/walks/*（walks-dial 等已 ship）
- 既有 pet edit: src/app/app/pets/[petId]/* 或對應 edit form
- 既有 push functions: functions/src/index.ts 內 eveningWalkReminder (A1) + familyGoalMilestone (B2)
- 既有 schema: src/lib/types.ts 的 Pet
- mango palette: src/app/globals.css 的 @theme inline
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4

護欄
- 動 src/lib/types.ts + src/lib/firebase/pets.ts + src/lib/walk-goals.ts（新檔）OK
- 動 src/components/pets/pet-walk-goal-input.tsx（新檔）+ pet edit form 整合 OK
- 動 src/components/walks/pet-picker-dropdown.tsx（新檔）OK
- 動 src/app/app/walks/page.tsx（啟用 chevron + activePet state）OK
- 動 functions/src/index.ts (A1 + B2 threshold)OK
- 動 firestore.rules + messages/*.json OK
- 不動 walks logic / tracking / done screen 結構
- 不動 leaderboard scoring（不依 goal）
- 不動 A2 streak warning push 邏輯（streak 跟 goal 解耦）
- 不動 mango tokens
- 不引入新 input / dropdown library
- Functions 端不能 cross-import src/lib/（要內聯 helper）

實作順序
1. Schema + helper: types.ts + walk-goals.ts + DEFAULT_WALK_GOAL_MINUTES
2. updatePetWalkGoal in pets.ts + firestore.rules
3. pet-walk-goal-input 元件 + 整合 pet edit form
4. pet-picker-dropdown 元件
5. walks page 啟用 chevron + activePet state + lastPetId localStorage
6. walks-dial / week-strip / hero copy 改用 activePet goal（getPetWalkGoalMinutes）
7. A1 + B2 functions 改用 walker 主寵物 walkGoal.minutes（內聯 helper）
8. i18n keys 補
9. npx tsc --noEmit pass（functions + frontend）
10. dev server Chrome MCP 跑 single pet + multi pet flows
11. Manual test push（改 walkGoal 後看 20:00 cron 是否用新 threshold）
12. commit 拆 6 個（或合併自選）
13. push origin main + functions deploy

預驗收（spec 內 checklist 跑完）
- Pet edit walkGoal 寫入 Firestore 對
- Walks page 單/多 pet UX 對（chevron 隱/啟）
- A1/B2 push 用新 threshold
- A2 不動 + leaderboard scoring 不變
- Existing user 沒 walkGoal → fallback 30
- Lighthouse a11y 不掉

回報格式
- 每 commit hash + 1 行 review note
- 全部 ship 後 summary 給 PM 收尾 roadmap
- 標記是否啟用了 Phase 1 v2 原 DEFERRED chevron 邏輯

開工。
```
