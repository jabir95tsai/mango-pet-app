# 好友搜尋 — case-insensitive prefix match

狀態：READY-FOR-DEV（PM 升級 backlog 條目 + 補 backfill 規範）
建立日期：2026-05-23
最後更新：2026-05-23
規格作者：PM session @ 3cb6fec（backlog 條目原作：Bug Hunter session 2026-05-22）
角色：Backend（schema + backfill + lib）

## User Story

作為**使用者**，我搜尋好友時想要：
- 輸入「jabir」（小寫）能找到 displayName 是「蔡智博Jabir」的人
- 輸入「Jabir」也能找到（**case-insensitive**）
- 「蔡」「蔡智博」也能找到（中文 prefix match 已有，不變）

目前狀況：Firestore range query 是 case-sensitive 且只能 prefix-match — 「蔡智博Jabir」prefix 是「蔡」不是「Jabir」，加上 case-sensitive，使用者搜「jabir」/「Jabir」都搜不到。Bug Hunter 已修最明顯的 bug（強制 `.toLowerCase()` 讓任何含大寫字母的名字都搜不到 — 見既有 commit `44bb159`），完整解法需要 schema 改動。

## 為什麼是現在做

- 家庭 epic 收完，社群 social feature（PRD §3.6）是合理下個方向
- 社群還小、user 數小 → schema 改 + backfill 成本最低時機
- 上架前該收乾淨「使用者搜尋找不到朋友」這個明顯 friction

## Decisions

### Decision 1: shadow field 方案

加 `displayNameLower` 欄位到 `users/*`，**vs 外部 search service**（Algolia / Typesense）。

**PM 預設**：shadow field
- 零成本、零依賴
- 對「prefix lowercase match」足夠（解決 80% 痛點）
- 中段 match（e.g. 搜「智博」找「蔡智博Jabir」）**不在這次範圍** — 真正中段 match 才需要外部 service

### Decision 2: backfill 策略 — admin callable + audit doc

沿用 #6 legacy-path-cleanup 的 admin-script pattern：
- 新 callable `backfillDisplayNameLower({ dryRun: boolean })`
- 跑一次補齊所有 existing users 的 `displayNameLower`
- 寫 audit doc `displayNameLowerBackfills/{ISO}`

### Decision 3: 即時 vs 排程

**PM 預設**：即時（callable 同步跑完，data 量小 < 30 users）。

未來如使用者數 > 1000 才需要 batch / async。

## 完成標準

### Phase 1: Schema + upsertUser

- [ ] `src/lib/types.ts` 的 `AppUser` 加 `displayNameLower: string`（新 doc required；現有 doc backfill 前 optional → backfill 後 required）
- [ ] `src/lib/firebase/users.ts` 的 `upsertUser` 寫入時同步寫 `displayNameLower: displayName.trim().toLowerCase()`
- [ ] 包含 displayName 變更時也寫（user 改名 → 自動更新 displayNameLower）

### Phase 2: Backfill migration

- [ ] 新 callable `backfillDisplayNameLower({ dryRun: boolean })` in `functions/src/index.ts`
  - 沿用 `legacy-path-cleanup` 的 admin-script pattern（`functions/scripts/run-backfill-display-name-lower.mjs` + `applicationDefault()` 跳過 custom claim）
  - 對 `users/*` collection 掃過去
  - 對每個 user doc：若無 `displayNameLower` → 計算 `displayName.trim().toLowerCase()` 寫入
  - `dryRun = true`：log 將要寫的 count，不改資料
  - `dryRun = false`：實際 batch update
  - 寫 audit doc `displayNameLowerBackfills/{ISO}`：
    ```ts
    {
      ranAt: Timestamp;
      mode: "dryRun" | "real";
      counts: { total: number; missing: number; written: number };
    }
    ```
- [ ] 跑順序：dryRun → review log → real run

### Phase 3: searchUsers 改 query

- [ ] `src/lib/firebase/users.ts` 的 `searchUsers(q)` 改 query：
  - 把現有「強制 .toLowerCase() input」邏輯保留（user 輸入「Jabir」/「jabir」都會被 normalize）
  - query 改打 `displayNameLower` 欄位：
    ```ts
    where("displayNameLower", ">=", qLower)
      .where("displayNameLower", "<", qLower + "")
      .orderBy("displayNameLower")
      .limit(10)
    ```
- [ ] 對中文 prefix search：仍能用 `displayNameLower` 因為中文不受 lowercase 影響（「蔡智博」.toLowerCase() === 「蔡智博」）
- [ ] 拿掉 Bug Hunter `44bb159` commit 加的「強制 .toLowerCase() 但 query 仍打 displayName」邏輯（變成 dead path）

### Phase 4: Index + rule

- [ ] `firestore.indexes.json`：可能需要新增 single-field index for `displayNameLower`（Firestore 通常自動建，但 deploy 後跑 query 看 console 錯誤）
- [ ] `firestore.rules`：read 規則沿用既有 `users/{uid}` 允許 signed-in user 讀（無需改）

## 成功指標

- 跑完 Phase 2 後，`users/*` 100% docs 有 `displayNameLower`（dryRun 確認 missing=0）
- 搜「jabir」（小寫）能找到「蔡智博Jabir」、「JabirTsai」、「jabir test」等所有 displayName 含 lowercase 開頭 prefix 為 "jabir" 的使用者
- 搜「Jabir」（首字大寫）跟 search「jabir」結果**完全一樣**
- 搜「蔡」仍能找到「蔡智博Jabir」（中文 prefix 不受影響）

## 不在這次範圍

- **中段 match**（搜「智博」找「蔡智博Jabir」）— 需要 Algolia/Typesense
- Fuzzy match / 拼音 / phonetic
- 多欄位 search（同時搜 displayName + email）
- search by email（隱私風險，PRD 沒列）
- Search analytics（query log）

## 技術筆記

### 動到的檔案

- `src/lib/types.ts`：`AppUser` 加 `displayNameLower`
- `src/lib/firebase/users.ts`：`upsertUser` 寫入 + `searchUsers` query 改
- `functions/src/index.ts`：新 callable `backfillDisplayNameLower`
- `functions/scripts/run-backfill-display-name-lower.mjs`：**新檔**（沿用 cleanup script pattern）
- `firestore.indexes.json`：可能新 index（看 Firestore console 錯誤訊息）
- `docs/firestore-schema.md`：`users/{uid}` schema 表加 `displayNameLower` 欄位

### 部署順序

1. `npx firebase deploy --only functions:backfillDisplayNameLower`
2. `node functions/scripts/run-backfill-display-name-lower.mjs --dry-run` → review log
3. `node functions/scripts/run-backfill-display-name-lower.mjs` → real run
4. 確認 dryRun 第二次跑 missing=0
5. `git push origin main`（前端 lib + types 改動）
6. 確認 production 搜「jabir」「Jabir」「蔡」三類 query 都正確

### 跟其他 spec 的關聯

- **delete-account**：刪 user 時連 `displayNameLower` 一起刪（隨 user doc）— 不需改 delete-account spec
- **legacy-path-cleanup**：backfill script pattern 沿用，**不衝突**

## 開放問題

- [x] shadow field vs Algolia ✓（PM 預設 shadow field）
- [x] backfill 即時 vs 排程 ✓（即時 callable）
- [x] 中段 match 含不含 ✓（不含，留給未來 search infra spec）
- [ ] 同 displayNameLower 兩個帳號（e.g. 兩個「jabir」）顯示順序？建議：依 `createdAt` 較舊先（不重要 — 一般使用情境少）
- [ ] User 改名後是否要 backfill 其他 user 的 friends/{friendUid} 子集合內冗餘存的 `displayName`？建議**不做**（friends 子集合是 snapshot 性質，per-user 渲染時改打 user doc latest displayName 即可）— **這條獨立於本 spec**，留 backlog 看實際 friction 再評估
