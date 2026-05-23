# Legacy 路徑清理

狀態：READY-FOR-DEV
建立日期：2026-05-23
最後更新：2026-05-23
規格作者：PM session @ 7f8c97d
角色：Backend（schema / rules / callable / migration 層）

## User Story

作為**長期維護者**（PM / Backend），我想刪掉 `users/{uid}/pets|walks|reminders|expenses|pets/{petId}/healthRecords` 這些 legacy sub-collection 的資料 + 對應 firestore.rules 的 match block，因為：
- 這些路徑已 deprecated 數週、client lib 不再寫入
- 留著佔資料、干擾 rule audit、讓 schema doc 必須維護兩套真相
- delete-account 的 cascade 邏輯需要明確 schema 邊界，legacy 殘留會讓未來修改變脆弱

## 為什麼是現在做

- Family migration（top-level + familyId）+ personal mode（top-level + familyId === null）已 ship 並穩定
- 所有 active 使用者都已被 `family-provider.tsx` 的 idempotent `migrateLegacy*ToFamily()` 搬過
- delete-account 已 ship，schema 已穩定
- 原本 roadmap 標「依賴 #4 dedupe」— 但 **#4 取消後本條獨立**，跟 dedupe 不是同件事（dedupe 是 family-scoped 內重複，legacy cleanup 是老 sub-collection 刪除）

## 不在這次範圍

- 動 family-scoped 資料（top-level pets/walks/...）
- 改 dedupe / merge 邏輯（#4 已取消 + B4 dormant 不動）
- 改任何 client UI（純後端 cleanup）
- 改 delete-account 邏輯
- 改 schema doc 的 family-scoped 段（只動 legacy 段）

## 完成標準

### Phase 1: 驗證 client 不再依賴 legacy 路徑

- [ ] `grep -r "users/" src/ functions/src/` 確認**所有讀寫 legacy 路徑**的程式只剩：
  - `family-provider.tsx` 的 `migrateLegacy*ToFamily()` 5 個 helpers（每個讀 legacy 寫 top-level）
  - 沒有其他直接 query / write `users/{uid}/pets`、`users/{uid}/walks`、`users/{uid}/reminders`、`users/{uid}/expenses`、`users/{uid}/pets/{petId}/healthRecords`
- [ ] 如有殘留 client query → 先改成 top-level 路徑或標記為待重構 → 再進 Phase 2

### Phase 2: 寫 cleanup callable（admin-only）

- [ ] 新 callable `cleanupLegacyPaths({ dryRun: boolean, targetUid?: string })` in `functions/src/index.ts`
  - `dryRun = true`：log 將要刪的 doc 計數，**不改任何資料**
  - `dryRun = false`：實際執行 batch delete
  - `targetUid` 給定 → 只清理該 user；undefined → 全 user collection 掃過去（小心 — 大規模操作）
  - 對每個 uid 掃以下 sub-collections + 全刪：
    - `users/{uid}/pets/{petId}/healthRecords/*`（pet 子集合先刪，避免 dangling）
    - `users/{uid}/pets/{petId}/walks/*`（舊 schema 殘留？確認有沒有）
    - `users/{uid}/pets/{petId}/reminders/*`（舊 schema 殘留？）
    - `users/{uid}/pets/*` 本身
    - `users/{uid}/walks/*`
    - `users/{uid}/reminders/*`
    - `users/{uid}/expenses/*`
  - 寫 audit doc 到 `legacyCleanups/{ISO}` 全域單一 doc 或 `users/{uid}/legacyCleanups/{ISO}`（建議：全域），含：
    ```ts
    {
      cleanedAt: Timestamp;
      reason: "schema-cleanup";
      mode: "dryRun" | "real";
      counts: { uid: string; pets: number; healthRecords: number; walks: number; reminders: number; expenses: number; }[];
    }
    ```
- [ ] 安全機制：
  - admin auth（custom claim `admin == true`）才能呼叫 — 否則 `HttpsError("permission-denied")`
  - 批次大小設限（每批 500 doc，避免 timeout / cost spike）
  - 失敗時繼續處理下一 uid（不 rollback 全部 — 純清理，沒「一致性」概念）

### Phase 3: Firestore rules 移除 legacy match blocks

- [ ] `firestore.rules` 移除以下 match blocks（如存在）：
  - `match /users/{uid}/pets/{petId}` + 其子集合
  - `match /users/{uid}/walks/{walkId}`
  - `match /users/{uid}/reminders/{reminderId}`
  - `match /users/{uid}/expenses/{expenseId}`
- [ ] 保留：
  - `match /users/{uid}` 本身（user doc 不動）
  - `match /users/{uid}/friends/*`、`/friendRequests/*`、`/favoriteRestaurants/*`、`/knowledgeBookmarks/*`（這些是現役 sub-collections，不是 legacy）

### Phase 4: Client lib + schema doc cleanup

- [ ] `src/components/family/family-provider.tsx`：移除 5 個 `migrateLegacy*ToFamily()` import + 呼叫（migration 已 done，留著只是 dead code）
- [ ] `src/lib/firebase/pets.ts` / `walks.ts` / `reminders.ts` / `expenses.ts` / `health-records.ts`：移除 `migrateLegacy*ToFamily()` 函式本身
- [ ] `docs/firestore-schema.md`：移除「Legacy（仍在 rules 中，client lib 已不寫入...）」段
- [ ] 更新「Migration 狀態」表把 legacy 那 5 條移除

## 部署順序（很重要）

```
Phase 2-3 先後順序矛盾 — 解法：兩步部署
```

1. **Step A**：先部署 Phase 2 callable（rule 還允許 legacy 路徑讀寫 → callable 可以刪資料）
   - `npx firebase deploy --only functions:cleanupLegacyPaths`
2. **Step B**：跑 callable dryRun：
   - `cleanupLegacyPaths({ dryRun: true })` → 看 audit log 確認刪除範圍合理
3. **Step C**：跑 callable real：
   - `cleanupLegacyPaths({ dryRun: false })` → 等執行完
4. **Step D**：部署 Phase 3 rules 移除 legacy match blocks
   - `npx firebase deploy --only firestore:rules`
5. **Step E**：部署 Phase 4 client cleanup
   - `git push origin main` → App Hosting auto-build

⚠️ Step C 跟 Step D 順序**不能反**：若先刪 rules、再跑 callable，callable Admin SDK 雖然繞過 rules 仍能讀寫，但同時 client 端的 `migrateLegacy*` helper 會開始 permission-denied 失敗。安全起見先把資料清光再撤 rules。

⚠️ Step D 跟 Step E 順序**不能反**：若先 push client（拿掉 migrate helper）、rule 還在，舊使用者 reload 後 migrate helper 已不存在 → 沒事。實際上**順序可換**，但建議先 rules 後 client。

## 成功指標

- 跑完 Phase 2 後 `users/{uid}/pets|walks|reminders|expenses` 全空（Firebase console 看 collection 是空的）
- `legacyCleanups/*` audit doc 寫入完整，包含 dryRun 跟 real 各一份
- 部署後使用者主功能（pets / walks / reminders / expenses / leaderboard / feed）正常運作 — Chrome MCP regression
- delete-account 仍正常運作（沒影響到 cascade 邏輯）
- `npx tsc --noEmit` pass after Phase 4 client cleanup

## 技術筆記

### 動到的檔案

- `functions/src/index.ts`：新 callable `cleanupLegacyPaths`
- `firestore.rules`：移除 legacy match blocks
- `src/components/family/family-provider.tsx`：移除 migration call
- `src/lib/firebase/pets.ts` / `walks.ts` / `reminders.ts` / `expenses.ts` / `health-records.ts`：移除 `migrateLegacy*` 函式
- `docs/firestore-schema.md`：移除 legacy 段 + Migration 狀態表

### Risk inventory（Backend session 過一遍）

- ⚠️ Phase 2 cleanup callable **沒有 rollback** — 是 destructive；務必先 dryRun
- ⚠️ 若 legacy 路徑有 client 仍在 query（Phase 1 漏掉的）→ Phase 2 後該 query 會回 empty → 該功能壞掉。Phase 1 grep 不能漏
- ⚠️ admin custom claim 設定方式：firebase auth admin token 或 admin SDK 設 — Backend session 自己處理
- ⚠️ 跑 `cleanupLegacyPaths` 不指定 `targetUid` = 對所有 user 跑 — 跑前確認自己 root user / admin 帳號有 production access

### 跟其他 spec 的關聯

- **delete-account**：legacy paths 不在 delete-account 的處理表內（spec 寫於 legacy 已 deprecated 前提下）。若 user 帳號刪除時還有 legacy data → 不會被刪。本 spec 跑完後不再有這個 case
- **dedupe (取消)**：無關聯
- **#3 family-leaderboard**：無關聯

## 開放問題

- [ ] `users/{uid}/pets/{petId}/healthRecords` 子集合**現在還在 top-level 還是 legacy**？schema doc 顯示「pets/{petId}/healthRecords」是 top-level（pets 是 top-level、healthRecords 是 pet 子集合），但 legacy `users/{uid}/pets/{petId}/healthRecords` 也存在（老 schema 殘留）— Phase 1 grep 時要明確區分
- [ ] admin custom claim 怎麼設？建議：Backend session 第一個任務是設一個 admin 帳號（PM 自己的 uid 或 dedicated admin uid）
- [ ] `legacyCleanups` audit doc 保留期？建議：永久（合規 + 給未來 debug）
