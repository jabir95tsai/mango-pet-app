# 排行榜 v2 — 計分公式擴充 + 以狗為中心排行榜（朋友 / 全 app 雙 tab）

> **狀態**：READY-FOR-DEV — PM spec（2026-05-30 PWA PM session；user 已拍板 5 開放問題 + 採用加權加法公式）。唯一待確認：加法係數 **0.4** 是否照用（user 看過示例後可微調，不擋開工）。
> **依賴**：實作要等 iOS P0 monorepo migration 穩定後再開 Backend / Feature Builder（README 並行規則：P0 期間暫停 production-code session）。
> **角色分工**：Backend（公式 + 聚合 + rules + migration）→ Feature Builder（狗榜頁 + tab）→ UI/UX（視覺）。

---

## 背景（現況事實，立基於 code）

- **計分公式**（`src/lib/scoring.ts`，migration 後在 `apps/web/`）：
  `score = round( distanceKm × typeFactor + durationMin × 0.5 + streakDays × 5, 1 )`
  - `typeFactor` 目前**只看體重**：`<5kg → 2.0`、`5–15 → 1.5`、`15–30 → 1.0`、`≥30 → 0.8`；非犬 / 無體重 → 1.0。
  - 分數於**遛狗結束時 client 端算好、存進 `walks/{walkId}` doc** 的 `score` 欄位；leaderboard 聚合器**直接讀存好的 score，不重算**。
- **資料模型**：`leaderboards/{period}/entries/{uid}` — **以人（walker uid）為中心**，period = `weekly_*` / `monthly_*` / `all_time`。
  - 寫入者：`aggregateLeaderboards`（每日 00:30 cron，全 app）、`recomputeWalkerLeaderboards`（onCreate 即時）、`recomputeWalkerLeaderboardsOnDelete`（onDelete）。
  - **personal-mode 遛狗（無 familyId）目前不進榜**。
- **Pet schema**（`packages/shared-types`）：已有 `breed?`（free-text string）、`birthday?`（Timestamp）、`weightKg?`、`walkGoal.source`（預留 'computed'）。計分目前只用 `weightKg`。
- **UI**（`app/app/leaderboard/page.tsx`）：排「人」；scope 切換「全部 / 家庭」（家庭是 client 端篩選）；period tab；**無朋友 tab**。
- **朋友**：`users/{uid}/friends` 子集合（存 uid / displayName / photoURL）。**讀好友的「狗」目前受 rules 限制**（pet 讀取限 family）。

---

## User Story

> 作為一個遛狗的人，我想看到**我的狗**在排行榜上的名次（不只是「我這個人」的名次），並且能在**朋友圈**和**全 app** 兩個範圍比分數，因為遛狗的主角是狗，我想為我的狗爭排名 — 而且小型 / 年長的狗也該有公平競爭的機會。

---

## 範圍（user 已拍板）

1. **計分公式擴充**：在現有體重因子上，**再加入品種、年齡**參數。方向 = **混合**（PM 提案，見下）。
2. **新增「以狗為中心」排行榜**，與現有「以人（walker）為中心」排行榜**並存**（不取代）。
3. 狗榜有 **兩個 tab：朋友 / 全 app**，都比分數。
4. **全 app** 隱私 = **預設上榜，可在設定關掉（opt-out）**。

### 完成標準

- [ ] 公式納入 weight + age + breed，且**向後相容**：無 age/breed 資料的狗，分數與現公式一致。
- [ ] 新狗榜頁（或現有 leaderboard 頁加「狗」維度）能看到狗的名次、頭像、總分、距離、次數、連續天數。
- [ ] 狗榜「朋友」tab：顯示「我的狗 + 好友的狗」並依分數排名。
- [ ] 狗榜「全 app」tab：顯示全 app 的狗排名；已 opt-out 的狗不出現在全 app。
- [ ] 設定頁有 opt-out 開關（預設上榜 = 開）。
- [ ] 人榜現有行為完全不變（並存）。

### 不在範圍

- 跨家庭「讀好友的 pet doc」直接讀取（改用 leaderboard entry denormalize ownerUid，避開 rules 大改 — 見資料模型）。
- 餐廳 / 其他不相關功能。
- 即時公里數 GPS 改動。
- AI 自動推算 walkGoal（那是另一條 per-pet-walk-goal follow-up）。

---

## ① 計分公式（user 拍板：加權加法，非乘法）

把現有「只看體重」的 `typeFactor` 升級成 **`dogFactor`**。**用加權加法**（避免乘法疊乘撞 3.0 上限、壓扁狗間差異 — user 2026-05-30 指出並選定）：

```
dogFactor = clamp(
  1
  + (weightFactor - 1) * 0.4
  + (ageFactor    - 1) * 0.4
  + (breedFactor  - 1) * 0.4,
  0.5, 3.0
)

score = round( distanceKm × dogFactor + durationMin × 0.5 + streakDays × 5, 1 )
```

> 結構刻意只改 distance 的乘數（dogFactor），duration、streak 維持不變（這兩個是「人的努力 / 一致性」維度，與狗體質無關）。

**為什麼加法不用乘法**：乘法下 `小型 2.0 × 高齡 1.4 × 低耐力 1.2 = 3.36` → 撞 clamp 3.0，條件好的狗全擠頂端、差異被壓扁。加法把每因子「偏離 1.0 的量」各乘 0.4 再相加，不疊乘，clamp 幾乎不觸發。

**係數 0.4**：三因子共用的「強度旋鈕」。0.4 = 體質因子份量適中、公式更看實際遛狗量（不鼓勵靠選狗刷分）。調高（0.5/0.6）→ 體質 handicap 更強；調低 → 更淡。**clamp 0.5–3.0 在加法下退化成髒資料防呆**（如異常 weightKg），正常範圍不會觸發。

**dogFactor 實際範圍示例（係數 0.4）**

| 狗 | weight | age | breed | dogFactor |
|---|---|---|---|---|
| 小型·壯年·一般 | 2.0 | 1.0 | 1.0 | 1.40 |
| 大型·壯年·一般 | 0.8 | 1.0 | 1.0 | 0.92 |
| 中型·壯年·一般 | 1.0 | 1.0 | 1.0 | 1.00 |
| 小型·高齡·低耐力 | 2.0 | 1.4 | 1.2 | 1.64 |
| 幼犬·小型 | 2.0 | 1.2 | 1.0 | 1.48 |

> ⚠️ **副作用（已知並接受）**：加法 + 0.4 會稀釋現有小型犬加成（距離乘數 2.0 → 1.4）。視為產品健康（少靠體質吃豆腐、多看實際遛狗量）。

**weightFactor（沿用現有，不動）**

| 體重 | factor |
|---|---|
| < 5kg | 2.0 |
| 5–15kg | 1.5 |
| 15–30kg | 1.0 |
| ≥ 30kg | 0.8 |
| 非犬 / 無體重 | 1.0 |

**ageFactor（新增，由 `birthday` 算當下年齡）— 公平化方向（幼犬 / 高齡不宜長走，同樣努力加權）**

| 年齡 | factor | 理由 |
|---|---|---|
| < 1 歲（幼犬） | 1.2 | 幼犬不宜長距離 |
| 1–7 歲（壯年） | 1.0 | baseline |
| 7–10 歲（熟齡） | 1.2 | 體力下降 |
| ≥ 10 歲（高齡） | 1.4 | 走一趟成就更大 |
| 無生日 | 1.0 | 中性 |

> 年齡用「遛狗當下」計算、凍結在 walk doc → 狗變老不需回算歷史。

**breedFactor（新增，只針對少數「低耐力」品種加權；其餘一律 1.0）— 混合方向（反映生理限制，但不懲罰高活動量犬）**

| 品種群 | factor |
|---|---|
| 短吻 / 低耐力（法國鬥牛犬、巴哥、鬥牛犬、西施、北京犬…可擴充清單） | 1.2 |
| 其他 / 未知 / 未填 | 1.0 |

> **刻意不懲罰高活動量品種**（哈士奇 / 邊牧等）：懲罰它們等於打擊「多遛狗」的核心動機，與產品目標相反。breed 是 free-text 不可靠，預設 1.0 讓多數狗不受影響，只對明確低耐力品種給 handicap。

**為什麼是「混合」**：weight + age 走**公平化 handicap**（弱勢狗加權，casual 遛狗者能競爭）；breed 走**反映真實生理限制**（低耐力品種加權）但**不反向懲罰高活動量犬**。三者經加權加法組合，整體偏公平化、低風險、可解釋、向後相容（無 age/breed 資料 → 該項 factor=1.0 → 對 dogFactor 無貢獻）。

**user 決定（2026-05-30）**：
- ✅ **breedFactor 要做**（保留品種因子）。factor 數值（1.2 / 1.4）照用。
- 唯一待微調：加法係數 **0.4**（看過示例表後若想調整 handicap 強度再說，不擋開工）。

---

## ② 以狗為中心排行榜 — 資料模型（交 Backend）

新增鏡像現有結構的集合：

```
dogLeaderboards/{period}/entries/{petId}
```

**Entry 形狀（提案）**
- `petId`, `petName`, `petPhotoURL`, `breed?`, `species`
- `ownerUid`, `ownerName`（**denormalize** — 朋友 tab 靠這個 client 端 filter，避開跨家庭讀 pet doc）
- `familyId?`（顯示「哪一家的狗」用）
- `totalScore`, `totalDistanceKm`, `totalDurationMin`, `walkCount`
- `streakDays`（這隻狗的連續被遛天數，跨任何 walker 加總）
- `ownerVisibility: 'public' | 'friends' | 'off'`（**denormalize 自 user 的總開關**，預設 `'public'`；讀取端用它決定哪個 tab 顯示 — 見 ③）
- `updatedAt`, `lastUpdatedAt`, `previousRank?`（沿用人榜的 glow / rank-overtake 機制）

**聚合邏輯**
- 把現有 cron / onCreate / onDelete trigger **加一個「依 petId 分組」的 pass**（與現有「依 walkerUid 分組」**同批跑**，不開新的 scheduled function → 控成本）。
- 一隻狗的分數 = 該 pet 所有 walk 的 score 加總（**跨家庭成員**：家人 A、B 都遛同一隻狗，分數都算進這隻狗）。
- ✅ **personal-mode（無家庭）的狗也納入狗榜**（user 2026-05-30 決定）。→ 狗的 petId 分組 pass **不沿用人榜的「排除 personal-mode」過濾**；人榜（walker）維持排除 personal-mode 不變。
- ⚠️ **需 Backend 確認**：`walks/{walkId}` doc 是否已存 `petId`（理論上一定有 pet 關聯，但要確認欄位名）。

---

## ③ UI — 兩個 tab（交 Feature Builder + UI/UX）

並存策略下的 IA（提案）：在現有 `/app/leaderboard` 頁，最上層加**維度切換「🧑 人 / 🐕 狗」**，狗維度下再有：
- **範圍 tab：朋友 / 全 app**
- 沿用現有 period tab（本週 / 本月 / 總榜）
- 沿用現有 glow 動畫 + reduced-motion skip

**全 app tab**：讀 `dogLeaderboards/{period}/entries`，只顯示 `ownerVisibility == 'public'`。
**朋友 tab**：讀同一份狗榜，client 端 filter `ownerUid ∈ {自己 + listFriends() 的 uid}` 且 `ownerVisibility ∈ {'public','friends'}`。
- → 不需要跨家庭讀 pet doc（entry 已 denormalize ownerUid / petName / photo / ownerVisibility）。
- → `'off'`：兩個 tab 都不出現（完全不參加狗榜）。**例外**：使用者在任何 tab 永遠看得到「自己的狗」名次（避免自己設 off 後完全看不到自己）。

**設定頁 — 排行榜可見度（user 決定：單一總開關 + 多選項）**

per-user 一個總開關 `users/{uid}.leaderboardVisibility`（**非 per-pet**，user 2026-05-30 選總開關），三選一：

| 選項 | 值 | 效果 |
|---|---|---|
| 全部公開（預設） | `'public'` | 全 app + 朋友都看得到我的狗 |
| 只給朋友看 | `'friends'` | 不上全 app，朋友 tab 仍看得到 |
| 完全不上榜 | `'off'` | 兩個 tab 都不出現（只自己看得到自己） |

> 改這個總開關 → 觸發該 user 名下所有狗 entry 的 `ownerVisibility` 更新（一個 callable 或 onWrite trigger 回寫 denormalized 值；Backend 決定實作）。

---

## ④ 開放問題 — 全部已由 user 拍板（2026-05-30）

1. **breedFactor 要不要做？** → ✅ **要做**（保留品種因子）。
2. **personal-mode 的狗納入狗榜嗎？** → ✅ **要納入**（solo 使用者也能玩）。實作：狗的 petId 分組 pass 不套人榜的「排除 personal-mode」過濾；人榜維持排除不變。
3. **opt-out granularity** → ✅ **per-user 總開關**（非 per-pet）：`users/{uid}.leaderboardVisibility`。
4. **opt-out 範圍** → ✅ **可以有選項**：總開關提供三選一 `public` / `friends` / `off`（見 ③ 設定頁表）。
5. **歷史分數遷移** → ✅ **接受漂移**（不 recompute 舊 walk；新 walk 很快稀釋，最省成本）。

> 全數 resolved → spec 為 **READY-FOR-DEV**。唯一可選微調：加法係數 0.4（不擋開工）。

---

## ⑤ 成本備註（對齊你的控成本原則）

- **不開新的 scheduled function**：狗榜聚合塞進**現有每日 cron 同一批** + 現有 onCreate trigger 多寫 ~1 筆 dog entry/walk。
- 全 app 聚合讀取量隨「全 app 總 walk 數」成長，但這是 **Firestore 讀寫**（非 Google Places 那種外部計費 API），且本來 cron 就掃過這些 walk。
- ⚠️ 狗榜**納入 personal-mode walk**（已拍板），cron / trigger 的狗分組掃描範圍比人榜大 → Firestore 讀取量上升，請 Backend 評估（可考慮只對「該 pet 有變動」增量更新，而非每日全掃）。
- 不需要新的第三方 API。**無新增外部 recurring API 成本**。

---

## Handoff

- **→ Backend / iOS Backend**（P0 穩定後）：
  - 實作 `dogFactor`（**加權加法** `1 + Σ (factorᵢ-1)*0.4`，clamp 0.5–3.0）於 `scoring.ts`；確認向後相容（無 age/breed → 等同舊行為）。
  - 新 `dogLeaderboards/{period}/entries/{petId}` 集合 + rules（讀：登入者可讀全 app 狗榜；寫：限 function）。
  - cron / onCreate / onDelete 加 petId 分組 pass，**含 personal-mode walk**；人榜維持排除 personal-mode。
  - `users/{uid}.leaderboardVisibility`（`public`/`friends`/`off`，預設 public）+ 改值時回寫該 user 所有狗 entry 的 `ownerVisibility`。
  - 確認 walk doc 有 petId。
  - **歷史分數不 recompute**（接受漂移，已拍板）。
- **→ Feature Builder**：狗榜頁 + 人/狗維度切換 + 朋友/全 app tab + 設定頁可見度三選一（public/friends/off）。
- **→ UI/UX**：狗榜 row 視覺（頭像用真照片、breed/age chip？）、人/狗維度 + tab 切換、沿用 glow。
- **→ PM（後續）**：等 user 對加法係數 0.4 最終確認（可不擋）；P0 穩定後排入 sprint，從 READY-FOR-DEV 轉「進行中」。
