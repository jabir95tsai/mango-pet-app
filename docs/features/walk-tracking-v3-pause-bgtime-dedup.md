# 遛狗追蹤 v3 — 暫停 + 停止確認 + 背景計時 + 重疊去重

> **狀態**：READY-FOR-DEV — PM spec（2026-06-02；user 提 3 需求）。
> **角色分工**：Feature Builder / UI/UX（§A 暫停+停止確認、§B 背景計時，改 `walk-tracking.ts` + `walk-tracking-view.tsx`）｜Backend（§C 狗榜重疊去重，改 `functions/src/leaderboard-helpers.ts`）。PM 不實作。
> **依賴**：並行期 main 乾淨時動工；§A/§B 與 §C 各自獨立可分開做。

## 背景（現況，立基於 code）

- 計時：`WalkSession`（`apps/web/src/lib/walk-tracking.ts`）用 wall-clock `Date.now() - startedAt - accumulatedHidden`，**目前會扣掉背景（hidden）時間** → 背景時計時等於暫停。`isPaused` 現指「分頁背景自動暫停」。
- 停止：`walk-tracking-view.tsx` `handleStop()` → 直接 `session.stop()`，**無確認**。
- 狗榜：`computeDogPeriodScore`（`functions/src/leaderboard-helpers.ts`）按 `petId` 撈全部 walk **直接加總**，**無重疊偵測** → 兩人同時遛同一隻狗 = 該狗分數雙倍。
- walk doc 有 `startedAt` / `endedAt`（Timestamp）+ `durationMin`；分數 = `distanceKm × dogFactor + durationMin × 0.5 + streakDays × 5`。

---

## §A 暫停 + 停止確認（Feature Builder / UI/UX）

### A1 停止要確認（避免誤觸）
- `handleStop()` 點「停止」→ **先跳確認 dialog**（「結束這次散步？」+ 確認 / 取消），確認才 `session.stop()`。沿用既有 confirm/dialog 元件。
- 追蹤畫面是 `fixed inset-0` 全屏，停止鈕容易誤按 → 確認必要。

### A2 加入「暫停 / 繼續」（使用者手動）
- 追蹤畫面加 **暫停/繼續** 按鈕（與停止並列）。
- 暫停時：**時間停止累加 + GPS 距離停止累加**；繼續則接續。
- 計時改用「明確暫停」模型：`WalkSession` 記 `pausedMs`（所有手動暫停區間總和）；`durationMin = (now - startedAt - pausedMs)/60000`（**不再扣背景 hidden 時間**，見 §B）。
- 暫停狀態 UI 明示（「已暫停」字樣 + 動效停）；wake lock 暫停時可釋放、繼續時重取。
- i18n（zh-TW + en）：暫停 / 繼續 / 停止確認文案。

> 註：`state.isPaused` 既有欄位語意要從「背景自動暫停」改為「使用者手動暫停」（§B 移除背景自動暫停）。

---

## §B 背景計時：時間在背景繼續跑（Feature Builder）

- **行為翻轉**：移除「扣掉 hidden 背景時間」邏輯（`accumulatedHidden` / `hiddenMs` / `hiddenSince` 這套自動背景暫停）。改成 **wall-clock 純跑**：`durationMin = (now - startedAt - pausedMs)/60000`，**背景 / 鎖屏 / 切 app 時時間照算**（用系統時間，回前景重算即正確）。
- ⚠️ **距離 vs 時間**：web/PWA 背景時 `watchPosition` 仍不會在背景累積距離（既有限制，memory：Web GPS 限制已接受）。所以「背景走一段」= **時間有算、距離不會增加**。可接受（user 明確要時間在背景跑）；UI 可在回前景時提示「背景期間未記錄距離」。
- 既有「背景暫停警告」改為「背景不影響計時」的訊息（或移除警告）。
- ⚠️ **失控保護（開放問題 B-1）**：移除自動背景暫停後，使用者若忘記停止 → 計時可能跑數小時。PM 預設加 **safeguard**：超過 X 小時（預設 3h）自動停止或跳「還在散步嗎？」確認。避免 runaway duration 灌分。
- 對齊既有 React #300 修復：`walks/page.tsx` 的 confetti useEffect 仍須在 0-pet early-return 之上（`ad90acf`，勿動）。

---

## §C 狗榜重疊去重：一起遛狗不重複計分（Backend）

**問題**：家人 A、B 同時遛同一隻狗 Mango，各自記一筆 walk → 狗榜 `computeDogPeriodScore` 把兩筆都加 → Mango 分數雙倍（實際只走一次）。

**修法**（`computeDogPeriodScore`，按 `petId` 撈出該狗 walks 後、加總前）：
- 偵測**時間重疊**的 walk（同 petId、`[startedAt, endedAt]` 區間有交集）→ **合併成 union 區間**，重疊時段只算一次。
- **duration**：用合併後 union 的總時長（重疊段不重複）。
- **distance**：⚠️ 開放問題 C-1 — 兩人 GPS 同一隻狗，PM 預設**取重疊群組的 max（非 sum）**（同一段路只算一次，取較準的一筆）。
- **walkCount / streak**：重疊群組算 1 次 / 當天算 1 天。
- 用既有 `(petId ASC, startedAt ASC)` composite index 撈出後做區間合併（記憶體內 O(n)）。

**範圍界定**：
- **只改狗榜**。**人榜（walker）不動** —— 每個人各自確實走了，walker 各得自己的分，合理（除非 user 另指示）。
- 重疊判定門檻：PM 預設「區間有任何交集即視為一起遛」；可加最小重疊閾值（如 ≥5 分鐘重疊才算）避免巧合擦邊 → 開放問題 C-2。

---

## 開放問題（PM 有預設）
- **B-1 失控保護**：背景計時上限 / 自動停止？PM 預設 3h 後「還在散步嗎？」+ 自動停止。
- **C-1 重疊 distance**：重疊群組 distance 取 max（PM 預設）還是別的？
- **C-2 重疊門檻**：任何交集即算（PM 預設）還是 ≥N 分鐘交集才算？
- **C-3 歷史資料**：去重只影響「之後重算」；既有已聚合分數要不要重算一次？PM 預設接受漂移（不回算），下次該狗有 walk 變動時自然重算。

## 成本備註
- §A/§B 純前端，無成本。
- §C 在既有狗榜聚合內加區間合併（記憶體 O(n)），不新增 query / function / index。無新外部 API。

## Handoff
- **→ Feature Builder / UI/UX**：§A（停止確認 dialog + 暫停/繼續按鈕 + pausedMs 計時 + wake lock）、§B（移除背景自動暫停、wall-clock 純跑、失控 safeguard、背景未記距離提示）+ i18n。
- **→ Backend**：§C（`computeDogPeriodScore` 加重疊區間合併；只動狗榜；duration=union、distance=max、count/streak 去重）。
- **→ PM**：開放問題 B-1 / C-1 / C-2 / C-3 收 user 確認後鎖定。
