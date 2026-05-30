# Web/PWA × iOS 並行維護 — Freeze / Catch-up Policy

狀態：**ACTIVE POLICY**（Cross-platform PM 維護）
建立日期：2026-05-29
規格作者：Cross-platform PM session
配合：[`ios-app-strategy.md`](./ios-app-strategy.md) §並行 PWA 維護策略、[`ios-parity-checklist.md`](./ios-parity-checklist.md)、[`../team/README.md`](../team/README.md) §並行模式

> D3 決定 = **PWA + iOS 並行維護**(不是停掉 PWA)。但「並行」需要紀律,否則 iOS 永遠追不上 web、或 P0 搬路徑時撞車。
> 本 doc 把「什麼時候凍結什麼、web 還能 ship 什麼、iOS 何時 catch up」講死。

## 兩層模式速查

| 期間 | 模式 | web production code 能不能動 |
|---|---|---|
| ~~**P0 monorepo migration**~~ | ✅ **完成 + 解凍(2026-05-31)** | freeze 已解除,見 §1 |
| **P1–P7 iOS 開發**（~11 週,👈 **目前在此**） | 🟡 **Parallel guarded** | **能,但分級**(見 §2) |

---

## 1. P0 Hard Freeze（monorepo migration 期間）— ✅ 已解凍（2026-05-31）

> **狀態:freeze LIFTED**。P0 migration 已 merge main(`3961f19`)、App Hosting build 由 `c94c384` 修綠、exit criteria 全達成(iOS Backend 2026-05-31 驗證:branch/main build 綠 + `tsc --noEmit` pass + `apps/web` dev 正常 + production golden path 驗 web 沒壞)。**現進入 §2 Parallel guarded**。
> ⚠️ 過程偏離:此次 migration **直接推 main**(非 spec 要求的「先在 `ios-p0-monorepo` branch build 全綠才 merge」),production build 紅約 44 分鐘(靠 last-good rollout 撐著,使用者無斷線)。下次碰 repo shape 的大改回到 branch-first。
> 以下規則保留作為**未來任何 repo-shape 級大改**(例:再拆 package、再搬路徑)的 reusable freeze playbook。

P0 要把 `src/` 搬進 `apps/web/`、改 App Hosting rootDir、建 `packages/*`。這會碰 **repo shape**,任何同時改 `src/` 的 session 必撞 + rebase 地獄。

**凍結範圍**：
- ❌ 不開任何其他 production-code session(Web Bug Hunter / UI/UX / Feature Builder / Backend 全暫停)。
- ❌ 不 ship 任何 web feature / fix。
- ✅ 只允許:P0 migration session 本身(iOS Backend 主導 + iOS Feature Builder scaffold)。
- ✅ 允許:PM / Cross-platform PM 動 `docs/`(零碰 code,不衝突)。

**例外(唯一)**：production 出現 **P0 級事故**(資料/安全/錢/全站掛)。此時:
1. 暫停 migration session(別讓兩個 session 同時改路徑)。
2. 在 **migration branch 之外**、從 `main` 開 hotfix → 修 → ship。
3. migration branch 事後 rebase 上新 main。

**Exit criteria(解凍條件)**：
- migration branch 的 App Hosting branch build **全綠**。
- `npx tsc --noEmit` pass。
- web 在 `apps/web` 下 `npm run dev` 正常。
- merge 進 main + production 驗證 web 沒壞。
- ✅ 達成 → 進入 §2 Parallel guarded。

**回滾**：細節見 [`ios-p0-monorepo-migration.md`](./ios-p0-monorepo-migration.md) 回滾策略;原則是 migration 全程在 branch,main 永遠可部署。

---

## 2. P1–P7 Parallel Guarded（iOS 開發期間 web 還能動什麼）

P0 完成後 web 改動只碰 `apps/web/**` + 可能 `packages/*`,iOS 碰 `apps/ios/**` + `packages/*`。**`packages/*` 是唯一共撞區**。

### Web 改動分三級

| 級別 | 例子 | 能不能在 iOS 期間 ship | 機制 |
|---|---|---|---|
| **Critical fix** | 資料/安全/錢/核心 flow 壞 | ✅ 立刻 ship | Web Bug Hunter session;ship 後登記到 [`ios-parity-checklist.md`](./ios-parity-checklist.md) 讓 iOS catch up |
| **Small polish** | typo / icon / copy / 小 CSS | ✅ 可 ship,但**攢著** | 不必每個都打斷;iOS 在 **P7 polish** 統一 catch up |
| **New feature** | 新的整塊功能 | ⚠️ **預設不 ship**(見決策規則) | 寫進 backlog / roadmap「想做但還沒規格」,等 batch 決策 |

### 新功能「誰先做」決策規則

iOS 開發期間冒出新 feature idea 時,**預設 = 先不做,記下來**。真要做才走這棵樹:

1. **是不是核心遛狗 loop 的關鍵缺口?** 否 → 記 backlog,post-launch 再排。是 → 往下。
2. **web-first 還是 cross-platform 一起設計?**
   - 若該 feature 純 web UX(例:桌面版專屬) → web-only,iOS 不跟。
   - 若兩端都要 → **cross-platform 一起設計 spec**(避免 web 先做完、iOS 又得重想),schema/functions 改動同 PR 改 `packages/shared-types`。
3. **會不會拖慢 iOS ship?** 會 → 默認延到 iOS 上 App Store 之後。Cross-platform PM 寧可 iOS 先收斂上架,再開 sync sprint。

> **PM 立場**:iOS 開發期間,**web 進入「維護 + critical only」**,主動避免開新 web feature。理由 = 並行最大風險是「iOS 永遠 catch up 不完」(strategy RED FLAG)。user 仍可 override,但每 override 一個 web 新 feature = iOS ship 日期往後推。

---

## 3. Catch-up Sprint 節奏

iOS 不是即時追 web,而是**有節奏地追**:

| 觸發點 | 動作 |
|---|---|
| **每個 P-phase 收尾** | Cross-platform PM review 該 phase 期間 web 新 ship 的東西(查 parity checklist §A/§B 新增列),decide 下個 phase 內順手 catch up 還是延到 P7。 |
| **Critical web fix ship 時** | 若該 fix 落在 iOS 已做完的 feature → iOS 插隊同步;若落在還沒做的 phase → 自然會做到。 |
| **App Store submit 前(P7)** | 一次性 catch-up sprint:把 small polish + baseline 後的 web ship(如照片圖庫)+ 任何延後項清掉,讓首版 iOS 對齊「當下 web」而非「3 個月前 snapshot」。 |
| **iOS 上架後** | 開 **post-launch sync sprint**,清 deferred-v1 項(餐廳 / 知識庫等,見 parity checklist Open Q1/Q2)。 |

---

## 4. Git 紀律（並行雙開）

細則在 [`../team/README.md`](../team/README.md) §並行模式,要點:

- **Push 三件套(永遠做)**:`git fetch && git pull --rebase origin main && git push origin main`。
- **角色分流不分檔**:iOS Feature Builder(`apps/ios/`)+ Web UI/UX(`apps/web/`)安全;❌ 兩邊都改 `packages/*` 要先講。
- **Worktree(建議啟用)**:iOS 長期開發期間,web 維護與 iOS 各開一個 worktree(共用 `.git`),徹底隔離 working tree。
- **P0 期間例外**:見 §1,P0 不並行。

---

## 5. Policy 取捨 — ✅ 已拍板（2026-05-30 iOS PM）

- **PWA 在 iOS 期間是否「凍結新功能」?**
  **✅ 決定 = 維持預設「critical + polish only,新 feature 預設不做」**（user 無特別意見 → 採 Cross-platform PM 中庸預設,iOS PM 2026-05-30 拍板）。
  - 含意:iOS 開發期間 web 進入「維護 + critical only」;polish 攢著 P7 統一 catch up;新 feature 預設不做,真要做走 §2 決策樹。
  - 未採用的兩端(保留紀錄,user 日後可 override):
    - 若改為 **PWA 繼續積極 ship 新 feature** → iOS ship 日期相應延後,每個新 feature 進 parity checklist 排 catch-up。
    - 若改為 **完全集中 iOS（連 polish 都停）** → 更快 ship iOS,但 web 體驗 3 個月不進步。
  - **Override 規則**:user 每 override 放行一個 web 新 feature = iOS ship 日期往後推 + 該 feature 進 [`ios-parity-checklist.md`](./ios-parity-checklist.md) 排 catch-up。

## 維護紀錄

- 2026-05-29 建立(Cross-platform PM):兩層模式(P0 hard freeze / P1–P7 parallel guarded)+ web 改動三級分類 + 新功能誰先做決策樹 + catch-up 節奏 + 1 個 user policy 取捨。
- 2026-05-30 §5 拍板(iOS PM):user 無意見 → 維持「critical + polish only」預設;open question 結掉,改為 ACTIVE 決策 + override 規則。
- 2026-05-31 **P0 hard-freeze 解除**(Cross-platform PM):iOS Backend 回報 exit criteria 全達成 → §1 標 LIFTED + 記過程偏離(直推 main、build 紅 44 分)。進入 §2 parallel guarded;放行 iOS Feature Builder P0 Step 7(Expo scaffold)。§1 規則保留為未來 repo-shape 大改的 reusable playbook。
