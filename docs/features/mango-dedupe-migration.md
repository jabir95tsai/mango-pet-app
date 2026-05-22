# 寵物去重 migration

狀態：READY-FOR-DEV
建立日期：2026-05-22
最後更新：2026-05-22
規格作者：PM session @ 3298731
交付角色：**Backend**（非 Feature Builder — 這是 schema/migration 層工作）

## User Story

作為**從 legacy 路徑升級的使用者**，我希望在 `/app/pets` 不要看到兩隻同名同生日的 Mango，因為**這是 family migration 從 legacy 路徑帶過來的重複資料，不是我自己建的**。

## 為什麼是現在做

- 目前資料量小（少數測試家庭、自己帳號就中），是寫 / 跑 dedupe 邏輯最安全的時機
- 越晚做，子集合（healthRecords / walks / reminders / expenses）累積越多，合併邏輯越複雜、bug 風險越高
- backlog.md 範例條目本來就是這個（PM 把它正式升級為 spec）

## 完成標準

- [ ] 寫一個 callable Cloud Function（admin-only 或限本人觸發），不是定時：
  - `dedupePets(familyId: string, dryRun: boolean)`
  - dryRun = true：印出將要做的 merge / delete 計畫，**不改任何資料**
  - dryRun = false：實際執行
- [ ] 偵測重複的判定：**同一個 familyId 內**，pet doc 的 `(name, species, birthday)` 三個欄位全部相同
  - birthday 可能是 null → 兩個都 null 也算同一隻
  - 大小寫 / 前後空白：name 用 trim + lowercase 後比對（顯示時用原始）
- [ ] canonical pet 選擇邏輯：**保留 `createdAt` 最舊**那一隻；若 createdAt 都相同（migration 同時寫的）則保留 docId 字典序最小那隻
- [ ] 子集合處理：所有重複 pet 下的 healthRecords / walks / reminders / expenses 全部**搬到 canonical pet**（重新指 `petId`），不刪資料
- [ ] 搬完之後刪除重複的 pet doc（不是 canonical 那隻）
- [ ] 寫 audit log doc 到 `families/{familyId}/migrations/dedupe-{timestamp}`：
  - 記錄哪些 petId 被 merge 進哪個 canonical
  - 多少子集合 doc 被搬
  - 跑的人是誰、何時跑
- [ ] dryRun 模式輸出**同樣格式的計畫**（log 而非 audit doc）
- [ ] rollback 計畫寫進 spec / commit message：
  - 因為刪資料前先搬子集合，最壞情況是「子集合搬成功但 pet doc 沒刪」→ 重跑安全（idempotent 設計）
  - 「pet doc 刪了但子集合沒搬完」→ 嚴禁；要嚴格事務或 batch
- [ ] 提供「先跑 dryRun → 看 log → 再跑真實」的標準 SOP 寫進 `docs/backend-ops.md` 或 spec 附錄

## 成功指標（執行後驗證）

- 跑完後：`/app/pets` 對每個 familyId 都沒有 `(name, species, birthday)` 全相同的 pet
- 跑完後：任一 (canonical pet 的)健康紀錄 / walk / reminder / expense 數量 ≥ 原本 canonical + 被合併者的總和
- 自己帳號跑完只剩一隻 Mango，且兩隻 Mango 原本的子集合資料都還在
- audit doc 寫入完整

## 不在這次範圍

- 跨 family 的去重（不同家庭可以有重名 pet，沒問題）
- UI 上提供「手動合併兩隻寵物」按鈕（這條只解 migration 殘留，不做產品功能）
- 不同 species 但同名的合併（例：Mango 狗 + Mango 貓 — 不合併）
- 自動定時跑（手動觸發即可，免得未來新使用者誤刪）
- 補回 legacy 路徑（已 deprecated）
- 「兩隻 pet 都有照片要保留哪張」的 UI 選擇（一律保留 canonical 的；非 canonical 的 photoURL 丟進 audit log 以防後悔）

## 技術筆記（給 Backend 參考）

- 接近的已實作功能：
  - `functions/src/index.ts` — 既有 Cloud Functions（aggregateLeaderboards / scanReminders 等）參考形狀
  - `src/components/family/family-provider.tsx` — legacy migration 邏輯（client-side 版本）參考分流策略
  - `src/lib/firebase/families.ts` — family helper 函式
  - `src/lib/firebase/pets.ts` — pet CRUD（看子集合路徑命名實際是 `families/{id}/pets/{petId}/healthRecords/...` 還是其他）
- collection / path 預估：
  - 讀：`families/{familyId}/pets/*` 全部 → group by (name, species, birthday)
  - 讀子集合：`families/{familyId}/pets/{petId}/{healthRecords|walks|reminders|expenses}/*`
  - 寫 audit：`families/{familyId}/migrations/dedupe-{ISO}`
- 新 security rule 需求：
  - audit doc 路徑要加規則：只有 family member 可讀，admin/function 可寫（建議只在 server-side function 寫入，rule 禁所有 client write）
- 新 index 需求：可能需要 `families/{familyId}/pets` by `(name, species, birthday)`，但因為 dedupe 是少量資料 + admin 觸發，建議直接 list 全部 client side group，**不加 index 省成本**
- 風險盤點（給 Backend 過一遍）：
  - 子集合搬移要 batch / transaction，避免中途失敗
  - 跨 collectionGroup 是否會踩到 leaderboard aggregation？(walk doc 改 petId 不會改 userUid，理論上 leaderboard 不受影響，但要驗)
  - 如果 reminder 已被勾且發出推播，搬 doc 不該重發 — 確認 `sent` / `notified` flag 跟著搬
  - rollback：建議跑前先匯出受影響 family 的 pets + 子集合到 GCS（用 firebase firestore export，限定 collection），出事可 restore

## 開放問題

- [ ] dedupe 觸發權限：admin only 還是「家庭 owner 可對自己家庭觸發」？建議 admin only 先做，未來再放
- [ ] 兩隻 pet 有不同 weight / bio / photo 時，canonical 的欄位是否要 merge 非空值？（建議：不要，避免 surprise；canonical 完全保留原樣，非 canonical 整個丟進 audit log）
- [ ] 若同 family 內有 3 個以上重複 → 全部合進 canonical，邏輯一致；要確認 batch 大小
- [ ] 跑完之後是否要通知家庭成員（in-app banner）？建議不要，使用者只會看到「Mango 變一隻了」自然發現
