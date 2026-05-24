# 推播通知設定

狀態：DRAFT（PM 預設 5 個 decisions，等 user confirm 後動工）
建立日期：2026-05-24
最後更新：2026-05-24
規格作者：PM session @ 77b8d8d
角色：Feature Builder（整 stack — schema + functions + UI + i18n）
工作量：**M**（schema additive + scanReminders 邏輯改 + settings UI 新 section）

## User Vision

> 「我們來完善提醒設定 — 應該是說推播設定」（2026-05-24）

對應 candidate C「推播設定頁」— 從 5 個 reminder-improvement angles 中 user 選定。

## Why now

- 推播現有實作（per PM 早期 push 系統解釋）：
  - ✅ Global enable/disable（settings PushToggle）
  - ✅ scanReminders 每 15 min 派送
  - ✅ Test push（sendTestPush callable）
  - ✅ FCM token cross-context reconcile (`9f1dc67`)
  - ❌ Quiet hours（半夜會被吵）
  - ❌ Per-pet 開關（多寵物時粒度不夠）
  - ❌ User 對推送行為的 fine control
- Reminder 系統已穩定（reminder-done-attribution / repeat-reminder-attribution 兩個 spec 都 SHIPPED）— 是 polish 推播 UX 的好時機
- 上架前該收乾淨「推播太擾人」這個常見 friction（PRD §6 上架條件雖未列推播 prefs 但常識性 polish）

## 5 個 product decisions（PM 預設待 user confirm）

| # | Decision | PM 預設 | 替代 |
|---|---|---|---|
| **D1** | Scope（要做哪幾項）| **Quiet hours + per-pet 開關**（兩個 high-value 功能）| + per-reminder-type filter（餵食/散步分流）/ + per-reminder doc level（太細）|
| **D2** | Quiet hours UI | **dual time picker + 3 個 preset**（「整天接收」/「夜間靜音 23-7」/「自訂」）| slider / 純文字輸入 / preset only 不可自訂 |
| **D3** | Quiet hours 內到期 reminder 行為 | **defer 到 quiet 結束後一次推**（preferred — 還是會通知，只是延後）| silently drop（不通知）/ in-app banner only / immediate but silent |
| **D4** | Per-pet 開關預設 | **預設 ON**（新建寵物自動 opt-in；既有寵物 backfill 為 on）| 預設 OFF（user 要 opt-in，但會漏掉很多通知）|
| **D5** | Settings 位置 | **新 section「推播設定」** in `/app/settings`，**位置在既有 PushToggle 下方、Privacy & Data 之上** | 擴展既有 PushToggle 變一個大區塊 / 獨立 page `/app/settings/notifications` |

## 完成標準

### Phase 1: Schema + Cloud Function

- [ ] `AppUser` 加 `pushPrefs?: PushPrefs` (optional)
  ```ts
  type PushPrefs = {
    quietHours?: {
      enabled: boolean;
      startHour: number;  // 0-23 local time
      endHour: number;    // 0-23 local time，end 可小於 start 表示跨日
    };
    perPetOptOut?: string[]; // pet ids 不推播（per Decision D4 預設 ON，opt-out 才寫）
  };
  ```
- [ ] `src/lib/firebase/users.ts` 加 helper `updatePushPrefs(uid, prefs)`
- [ ] `functions/src/index.ts` 的 `scanReminders` 改：
  - 計算 reminder 到期時 + 對應 recipient 的 timezone（用 user.locale 推測；無時區資訊預設 Asia/Taipei）
  - 檢查每個 recipient 的 `pushPrefs.quietHours`：
    - 若在 quiet 範圍 → 不立即推，標記 `deferredUntil: 下個 quietHoursEnd 對應的 Timestamp`
  - 檢查每個 recipient 的 `pushPrefs.perPetOptOut`：
    - 若 reminder 的 `petId` 在 opt-out 清單 → 該 recipient 不推（其他 family member 仍可能推）
  - 加新欄位 `reminder.deferredUntil?` 給 deferred 的 reminder；下次 scanReminders cycle 看到 deferredUntil <= now 就推
- [ ] Firestore rules：`pushPrefs` 寫入規則 — 限 owner 自己改

### Phase 2: UI — Settings 新 section「推播設定」

- [ ] `src/app/app/settings/page.tsx` 加新 section「推播設定」（位置：PushToggle 下方 / Privacy & Data 上方）
- [ ] 新元件 `src/components/settings/push-prefs-section.tsx`：
  - 「靜音時段」block:
    - 3 個 preset radio: 「整天接收」/「夜間靜音 (23:00 - 07:00)」/「自訂」
    - 自訂時顯示 dual time picker（start / end）
    - end 小於 start 自動視為跨日（24:00 後算到 end），UI 顯示「跨日」hint
  - 「每隻寵物推播」block:
    - 列出所有家庭 + personal pets
    - 每隻 pet 旁邊 toggle（ON/OFF）
    - 預設 ON；toggle OFF 寫進 perPetOptOut 陣列
- [ ] 沿用既有 PushToggle 不動（global enable/disable + 測試按鈕）
- [ ] i18n: `Settings.pushPrefs.*` namespace（zh-TW + en）

### Phase 3: Edge cases

- [ ] Quiet hours **跨日**處理（22:00-06:00 之類）— UI 顯示 hint，後端用 modulo 24 算
- [ ] 同一 reminder 在 quiet 內期間被多 cycle 看到 → idempotent（deferredUntil 已寫就不重設）
- [ ] User 改 quiet hours 中途，已 deferred 的 reminder 不重算（接受 latency）
- [ ] Per-pet opt-out 後 pet 被刪 → opt-out 陣列保留 stale id 但無害（下次 scan 不會 match）
- [ ] 既有 user 沒 pushPrefs → backend 視為「無 quiet hours + 全部 pet ON」（既有行為）
- [ ] Test push 不受 quiet hours / per-pet 影響（test 是 diagnostic，不該被 prefs 攔）

## 成功指標

- 自己 + 家人實測「半夜不再被推播吵」
- 多寵物 user 可關掉某隻 pet 的提醒推播
- 既有 push 通知功能無 regression（test push 仍 work、scanReminders 仍每 15 min 跑）
- 上線後 3 天內至少 1 個 user 設過 quiet hours

## 不在這次範圍

- Per-reminder-type filter（餵食 / 散步 分流）— UX 太細
- Per-reminder 個別開關（每個 reminder doc 上個 push flag）— 過度設計
- Priority levels（overdue 大聲 / normal 安靜）— OS-level 控制有限
- 多家庭分別 prefs（pushPrefs is per-user，跨家庭共用）— 不該分
- Push sound customization
- 推播內容語言切換（已 follow user.locale）
- Email fallback when push fails
- 推播分析（哪些 reminder 被點開了 / 忽略了）

## 技術筆記

### 動到的檔案

- `src/lib/types.ts`：`AppUser` 加 `pushPrefs?: PushPrefs`、export `PushPrefs` type
- `src/lib/firebase/users.ts`：加 `updatePushPrefs(uid, prefs)` helper
- `functions/src/index.ts`：`scanReminders` 加 quiet hours / per-pet 邏輯 + 新 `deferredUntil` 欄位
- `firestore.rules`：`users/{uid}` 規則允許 `pushPrefs` 寫入（限 owner）
- `firestore.indexes.json`：可能需新 index for `where("deferredUntil", "<=", now)` query — Backend 部署後看 Firestore console
- `src/app/app/settings/page.tsx`：加「推播設定」section
- `src/components/settings/push-prefs-section.tsx`：**新檔**
- `messages/zh-TW.json` + `messages/en.json`：`Settings.pushPrefs.*` namespace

### 部署順序

1. `npx firebase deploy --only firestore:rules`（先放寬 pushPrefs 寫入）
2. `npx firebase deploy --only functions:scanReminders`（後端 quiet hours / per-pet 邏輯）
3. `npx firebase deploy --only firestore:indexes`（如需）
4. `git push origin main`（前端 UI）

### Edge cases — 重要

| Edge | 處理 |
|---|---|
| Quiet hours 跨日（22:00-06:00）| UI 「跨日」hint；後端用 `(now.hour >= start) || (now.hour < end)` 判定 |
| User 在 quiet hours 內手動點 reminder 完成 | 不受影響（quiet 只擋 push，不擋 in-app action）|
| Family pet 被某 member opt-out → 其他 member 仍收 | scanReminders 按 recipient 逐一 check pushPrefs，per-recipient |
| Reminder 已 deferred 中途 user 關掉 quiet hours | 接受 latency；deferred reminder 仍等原本 deferredUntil。下個 scan cycle 才會被重新評估（不主動重排）|
| User 改名 / 換家庭時 pushPrefs | 隨 user doc，跟 user.uid 綁定（不跟 family 綁）|
| Personal mode user 的 pushPrefs | 同 family user，沿用 same schema |

### 跟其他 spec 的關聯

- **scanReminders（既有 Cloud Function）**：本 spec 改其邏輯，加 quiet hours / per-pet 過濾
- **delete-account**：刪 user 時 pushPrefs 隨 user doc hard-delete（已 cover）
- **data-export**：export 含 pushPrefs（隨 AppUser doc 已 cover — auto-include）
- **既有 PushToggle (settings)**：不動，仍是 global enable/disable + test push 入口

## 開放問題（PM 預設 + user push back）

- [ ] **D1 scope**：採 PM 預設「quiet hours + per-pet」？
- [ ] **D2 quiet hours UI**：採 PM 預設「dual time picker + 3 個 preset」？
- [ ] **D3 quiet hours 行為**：採 PM 預設「defer 到 quiet 結束後一次推」？
  - 替代 silently drop 在 quiet 期間到期的 reminder（不延後送）— PM 不推（reminder 設了就該到，只是延後比丟掉好）
- [ ] **D4 per-pet 預設**：採 PM 預設「ON」（既有 pet 自動 on）？
- [ ] **D5 settings 位置**：採 PM 預設「Settings 內新 section」？
  - 替代 「擴展既有 PushToggle」or 「獨立 /app/settings/notifications page」
