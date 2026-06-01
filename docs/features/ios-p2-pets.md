# iOS P2 — Pets Parity Spec（完整版 / ready-for-dev）

狀態：**READY-FOR-DEV**（iOS PM 2026-06-01；前置決策已拍板，sub-phase + 全 session prompt 備齊）
建立日期：2026-06-01
規格作者：iOS PM session
角色執行：**iOS Backend**（shared packages + native dep + gate）+ **iOS Feature Builder**（screens/flow）+ **iOS UI/UX**（polish pass，P2 後）
工作量：**L**（P2 是 parity 最大 group，~web 一半的元件量）
上承：[`ios-port-master-plan.md`](./ios-port-master-plan.md)（P2 data contract + native-dep gate inventory）｜parity：[`ios-parity-checklist.md`](./ios-parity-checklist.md) §A P2

> 對齊 web `apps/web/src/app/app/pets/**` + `components/pets/*` + expenses/health/reminders。後端（Firestore / Cloud Functions / Rules）**全部沿用不改**。

---

## 🎯 P2 完成定義（Milestone）

iOS 使用者在實機能：
1. 看 pets 列表 + switcher + header（真照片 fallback initial）。
2. 切 4 tab（概覽 / 提醒 / 開銷 / 健康），各 tab 內容對齊 web。
3. 開銷 donut + 分類 filter + camera FAB → AI 收據掃描（接同 `extractReceipt` callable）。
4. 健康體重 trend chart + 多型紀錄。
5. 提醒 list + form（含 DateTimePicker + repeat + notifyBefore）。
6. 新增/編輯寵物（avatar picker + walkGoal stepper），0-pet EmptyState。
7. 所有寫入接**同一個** Firestore（pets/reminders/expenses/healthRecords）+ 同 callables，web 端讀得到。

---

## ✅ 前置決策（iOS PM 2026-06-01 拍板，解 P2 blocker）

> 這些原本是 master plan 標的「P2 前要定」的開放項。為了讓睡眠中不卡，PM 直接定預設 + re-open 條件。

| # | 決策 | 選定 | 理由 / re-open |
|---|---|---|---|
| **D-i18n** | next-intl 能否在 RN 跑？ | **不能 → 起 `@mango/shared-i18n`** | next-intl 綁 Next.js（server components / next/navigation），RN 跑不了。共用層 = message JSON：shared-i18n 匯出 zh-TW/en catalog，**web 的 next-intl 改 import 同源 catalog**（低風險，next-intl 本來就讀 JSON），**iOS 用 `i18n-js`（純 JS）+ `expo-localization`（native，偵測 locale）**消費。→ P2 第一個前置 gated task。 |
| **D-tab** | 4-tab 用 `react-native-tab-view`？ | **不用 → 自刻 pill tab bar** | web 也是 pill tab、無左右滑切換。自刻省一個 native dep。re-open：若要 swipe-between-tabs 再引入。 |
| **D-modal** | 表單用 `react-native-modal`？ | **不用 → Expo Router modal/RN `Modal`** | Expo Router 內建 modal presentation 夠用，省 dep。re-open：若需複雜手勢 sheet。 |
| **D-datepicker** | reminder/health 日期選擇器 | **用 `@react-native-community/datetimepicker`** | de-facto 標準、跨 EAS profile 穩（master plan 註）。P2c 引入。**順帶 unblock P1b 手動補登的 datetime defer**（P2c 後可回補，low-pri）。 |
| **D-charts** | donut / 體重 trend | **手刻 `react-native-svg`**（不用 victory-native 等重 chart lib） | 對齊 web 手刻 SVG；最少 dep。P2b 引入 svg（多個後續 feature 都依賴它）。 |

---

## 📦 Shared-package 追加（P2 批次，先於 consumer 落地）

**`@mango/shared-types`** — 加：`Pet`/`PetInput`/`Species`/`Gender`/`WalkGoal`、`Reminder`/`ReminderInput`(+repeat enum+notifyBefore 常數)、`Expense`/`ExpenseInput`/`ExpenseCategory`/`ExtractedReceipt`、`HealthRecord`/`HealthRecordInput`/`HealthRecordType`(polymorphic data union)。web 改 import 同 package（移除重複定義）。

**`@mango/shared-business`** — 加：`startOfMonth`/`dayDiffFromNow`/`formatAge`/`toLocalDateInput`/`fromLocalDateInput`、walk-goal 常數已存在（P1）。`IMAGE_PRESETS`（avatar/receipt/post 維度，web+iOS 同尺寸）。

**`@mango/shared-i18n`（新建）** — zh-TW/en message catalog 單一真相；web next-intl + iOS i18n-js 共用。

> 落地次序硬規則：**shared-package 先 merge，consumer 後做**。每個 phase 開工前先補該 phase 型別。

---

## 🪜 P2 sub-phases（native-dep gate 為界，序列）

> 規則 4：每個新 native dep = 一條 branch + 一輪 `apphosting:rollouts:create -b <branch>` linux gate + 確認 root lockfile 含 linux binary。同類 dep 聚一 sub-phase 一次 EAS build 實機驗（無 Mac）。

### P2-pre — 前置（iOS Backend，無畫面）
- shared-types P2 批次 + shared-business（date utils + IMAGE_PRESETS）+ **shared-i18n 建置**（web 改讀同源 catalog → **web gate**；iOS 加 `i18n-js`+`expo-localization` → **native gate**）。
- 驗：web rollout gate 綠（沒破 next-intl）+ apps/ios + apps/web tsc 過。

### P2a — 骨架（iOS Feature Builder，**無新 dep**，可與其他 phase 並行）
- Pets list（FlatList of pet cards）+ switcher（`pets.length>=2` 才顯示 chevron）+ `/app/pets/[petId]` route。
- PetHeader（64px avatar + name/age/sex/weight chips；`formatAge`）。
- 4-tab pill bar（自刻；active tab 存 `?tab=` route param，deep-link）。
- Overview tab（2×2 StatGrid: nextReminder/monthSpend/weight/walkDays + upcoming reminder card + recent expense card；client filter）。
- data：`pets/{petId}`（ownerUid+familyId scope；personal: ownerUid==uid & familyId==null）onSnapshot；`reminders`/`expenses` client filter by petId。

### P2b — chart gate（Backend 加 `react-native-svg` → FB 畫）
- Expenses tab：month total bar + 手刻 svg donut + 8-cat legend pills + filtered FlatList（先不含 camera FAB，FAB 入口留到 P2d）。
- Health tab：手刻 svg area+line weight chart（last 6）+ HealthRecordCard FlatList（form 留 P2c）。
- ⚠️ chart 純度：weight 全等時 yScale 除零 safeguard；memoize；大資料上游預過濾。

### P2c — form/picker gate（Backend 加 `@react-native-community/datetimepicker` + `expo-image-picker` + `expo-image-manipulator` + `expo-linear-gradient`；建議拆 2 dep branch 序列驗：picker 一支、image+gradient 一支 → FB 做表單）
- Reminders form（DateTimePicker + repeat select + notifyBefore [0/15/60/1440/10080]）+ complete/edit/delete（callables `createReminder`/`updateReminder`/`completeReminder`/`deleteReminder`）。
- Expense manual form + Health 多型 form（weight/feeding/vaccine/vet/medication；建 weight 同步 `pet.weightKg`）。
- Pet edit form（avatar picker `expo-image-picker` + `expo-image-manipulator` IMAGE_PRESETS.avatar + walkGoal ±stepper clamp 5–120 step 5；`createPet`/`updatePet`；Storage `petAvatarPath`）。
- 0-pet EmptyState（`expo-linear-gradient` radial disc + paw + CTA）。

### P2d — camera gate（Backend 加 `expo-camera` + `NSCameraUsageDescription` → FB 做收據掃描）
- Expenses camera FAB → ReceiptScanner camera-first（capture → compress → 接 callable `extractReceipt`(gemini-2.5-flash) → 預填 expense form）。
- ⚠️ 模擬器無相機 → **必須實機驗**。

---

## 🔌 P2 native-dep gate 清單（序列順序）

| sub-phase | dep | gate |
|---|---|---|
| P2-pre | `i18n-js`(JS,無 gate) + `expo-localization`(native) | web gate(next-intl 沒破) + native gate |
| P2b | `react-native-svg` | native gate（後續多 feature 依賴，先過） |
| P2c | `@react-native-community/datetimepicker` | native gate（branch 1） |
| P2c | `expo-image-picker` + `expo-image-manipulator` + `expo-linear-gradient` | native gate（branch 2） |
| P2d | `expo-camera` | native gate + 實機相機驗 |

---

## 🤝 角色分工

- **iOS Backend**：P2-pre（shared packages + i18n）+ 每個 sub-phase 的 dep 引入 + gate + 任何 callable wrapper（createPet/updatePet/reminder callables/extractReceipt 接線 helper）+ Storage path helper（`petAvatarPath`）。
- **iOS Feature Builder**：P2a 骨架 + P2b/c/d 的 screens/flow（接 Backend 已過 gate 的 dep + helper）。
- **iOS UI/UX**：P2 視覺 polish 併入「walks polish pass 之後的 pets polish」（不阻塞功能）。
- **不碰**：functions / rules / indexes / storage.rules（後端沿用）。

---

## ⚠️ Edge cases（對齊 web）
- 0 pets → EmptyState（不顯示 tabs）。
- personal mode（無 family）→ pets/reminders/expenses scope `familyId==null`。
- 多 family → 依 currentFamilyId scope。
- receipt 拍照拒權 → fallback 手動輸入 expense。
- weight 紀錄建立 → 同步 `pet.weightKg`（單一真相）。
- Firestore composite index：部署前確認 `reminders`/`expenses`/`healthRecords` 查詢所需 index 已在 `firestore.indexes.json`（缺 → FAILED_PRECONDITION；不改 rules，但 index 若缺要補——這是唯一可能要動 backend 的點，發現即回報 iOS PM，由 Backend 評估）。

---

## ❓ Open questions（醒來定，不阻塞 P2-pre/P2a）
1. i18n catalog 落地形式：shared-i18n 匯出 JS object vs JSON 檔 import？（Backend P2-pre 時定，傾向 TS object 享型別）。
2. extractReceipt 在 iOS 的圖片格式/壓縮要不要跟 web 完全一致 preset？（P2d 時對齊 IMAGE_PRESETS.receipt）。
3. pets 列表要不要 pull-to-refresh / onSnapshot 即時（web 是 onSnapshot）→ 預設 onSnapshot。

---

## 🚀 Launch prompts（醒來照順序開 session，一個一個貼）

> 順序硬性：**P2-pre → P2a（可與後續並行）→ P2b → P2c → P2d**。每個碰 dep 的都 branch-first + linux gate。每個 session 開頭先 `git fetch && git log -6 --stat origin/main`。

### ① P2-pre — iOS Backend（shared packages + i18n）
```
平台：iOS｜角色：iOS Backend
先讀：AGENTS.md、docs/team/README.md（規則 4）、docs/team/ios-backend.md、docs/features/ios-p2-pets.md（§前置決策 + §shared-package）、docs/features/ios-port-master-plan.md（P2 data contract + dep inventory）

任務（branch-first，dep/web-touch → linux gate）：
1. @mango/shared-types 加 P2 types：Pet/PetInput/Species/Gender/WalkGoal、Reminder/ReminderInput(+repeat+notifyBefore 常數)、Expense/ExpenseInput/ExpenseCategory/ExtractedReceipt、HealthRecord/HealthRecordInput/HealthRecordType(polymorphic data union)。從 apps/web/src/lib/types.ts 抽，web 改 import 同 package（移除重複）。
2. @mango/shared-business 加：startOfMonth/dayDiffFromNow/formatAge/toLocalDateInput/fromLocalDateInput（pure，從 web 抽）+ IMAGE_PRESETS（avatar/receipt/post 維度，web+iOS 同尺寸）。
3. 建 @mango/shared-i18n：把 apps/web/messages/{zh-TW,en}.json 變成單一真相 catalog；apps/web 的 next-intl 改讀同源（i18n/request.ts import shared catalog，**驗證 web 沒破**）；apps/ios 加 i18n-js + expo-localization 消費同 catalog（建一個 t() helper + locale 偵測）。
護欄：不碰 functions/rules/indexes/storage.rules；web 只改 import 路徑不改行為。
驗證：apps/web + apps/ios tsc pass；**web rollout gate 綠（next-intl 沒破）**；root lockfile 含 expo-localization linux binary。
回報：commit hash + web gate 連結+綠 + 給 Feature Builder「shared 可 import 的東西 + iOS t() 怎麼用」。
```

### ② P2a — iOS Feature Builder（骨架，無新 dep，可並行）
```
平台：iOS｜角色：iOS Feature Builder
先讀：AGENTS.md、docs/team/ios-feature-builder.md、docs/features/ios-p2-pets.md（§P2a）、對照 web apps/web/src/app/app/pets/page.tsx + components/pets/{pet-header,pet-tabs,pet-avatar,stat-grid}*
前置：P2-pre 已 merge（shared-types Pet/Reminder/Expense + shared-business date utils + i18n t()）。

任務（純 apps/ios，**不加 dep**）：
- Pets list（FlatList pet cards）+ switcher（>=2 才 chevron）+ /app/pets/[petId] route
- PetHeader（64px avatar + name/age(formatAge)/sex glyph/weight chips）
- 4-tab pill bar（自刻；active tab 存 ?tab= route param）
- Overview tab（2×2 StatGrid + upcoming reminder card + recent expense card；client filter reminders.petId/!done、expenses.petId、startOfMonth/dayDiff）
- data：pets/{petId} onSnapshot（ownerUid+familyId scope；personal familyId==null）；reminders/expenses client filter
- i18n 走 shared-i18n t()
護欄：不碰 functions/rules/dep；reminders/expenses/health 的 form 與 tab body 細節留 P2b/c。
驗證：apps/ios tsc pass；未加 dep；未碰 web。
回報：commit hash + handoff（4-tab 切換 OK；overview 顯示正確）+ 給 iOS PM parity §A P2「list/switcher/header、4-tab、overview」可標進度。
```

### ③ P2b — chart gate（iOS Backend 加 svg → 同 session 或交 FB 畫圖）
```
平台：iOS｜角色：iOS Backend（dep）→ iOS Feature Builder（chart UI）
先讀：docs/features/ios-p2-pets.md（§P2b）、對照 web components/expenses/* + 健康 trend chart 元件
前置：P2a 骨架 + P2-pre。

Backend（branch-first + linux gate）：
- 加 react-native-svg；確認 root lockfile 含 linux binary；web rollout gate 綠（沒連坐）；發新 EAS build。
Feature Builder（接 svg）：
- Expenses tab：month total bar + 手刻 svg donut + 8-cat legend pills + filtered FlatList（policy native-upgrade 註記；camera FAB 入口留 P2d）。data：expenses/{expenseId}(payerUid+familyId scope)。
- Health tab：手刻 svg area+line weight chart(last 6) + HealthRecordCard FlatList（form 留 P2c）。data：pets/{petId}/healthRecords，query type==weight orderBy recordedAt ASC。
- ⚠️ weight 全等 yScale 除零 safeguard；memoize chart。
護欄：不碰 functions/rules；不自算金額/分類聚合（對齊 web helper，必要時抽 shared-business）。
驗證：tsc pass；web gate 綠；EAS build 連結。
回報：commit hash + 實機看圖（donut + weight trend）+ parity「開銷 donut」「健康 trend」可標進度。
```

### ④ P2c — form/picker gate（iOS Backend 加 picker+image deps → FB 做表單）
```
平台：iOS｜角色：iOS Backend（deps，建議拆 2 branch 序列）→ iOS Feature Builder（forms）
先讀：docs/features/ios-p2-pets.md（§P2c）、對照 web 的 reminder-form/expense-form/health-form/pet-form-dialog/pets-empty-state
前置：P2b。

Backend（branch-first，2 條 dep branch 各一輪 linux gate）：
- branch 1：@react-native-community/datetimepicker
- branch 2：expo-image-picker + expo-image-manipulator + expo-linear-gradient（app.json 加 NSPhotoLibraryUsageDescription）
- 各自 web gate 綠 + lockfile linux binary；發 EAS build。
- Storage helper petAvatarPath；createPet/updatePet + reminder callables wrapper（接同 functions，不改後端）。
Feature Builder（接 deps + helper）：
- Reminders form（datetimepicker + repeat + notifyBefore）+ complete/edit/delete
- Expense manual form + Health 多型 form（weight 同步 pet.weightKg）
- Pet edit form（avatar picker + IMAGE_PRESETS.avatar compress + walkGoal stepper clamp 5–120 step5）
- 0-pet EmptyState（linear-gradient）
護欄：不碰 functions/rules；image 壓縮走 shared IMAGE_PRESETS；callable region asia-east1。
驗證：tsc + web gate + EAS build；實機新增/編輯寵物 + 建提醒 + 建健康紀錄落地 Firestore。
回報：commit hash + parity「提醒 form」「pet edit」「健康 records」「empty state」可標進度。
```

### ⑤ P2d — camera gate（iOS Backend 加 expo-camera → FB 收據掃描）
```
平台：iOS｜角色：iOS Backend（camera dep）→ iOS Feature Builder（receipt UI）
先讀：docs/features/ios-p2-pets.md（§P2d）、對照 web receipt-scanner + extractReceipt callable（functions/src）
前置：P2c（image-picker/manipulator 已過 gate）。

Backend（branch-first + linux gate）：
- 加 expo-camera + app.json NSCameraUsageDescription；web gate 綠 + lockfile；發 EAS build。
- extractReceipt callable wrapper（接同 functions callable，gemini-2.5-flash，不改後端）。
Feature Builder：
- Expenses camera FAB → ReceiptScanner camera-first（拍 → compressImage(IMAGE_PRESETS.receipt) → extractReceipt → 預填 expense form → 存 expenses/{expenseId}）。
- 相機拒權 → fallback 手動 expense form。
護欄：不碰 functions/rules；receipt 圖保 OCR 可讀(~150 DPI)；≤8MB。
驗證：tsc + web gate + EAS build；**實機**拍收據 → AI 辨識 → 存。
回報：commit hash + parity「AI 收據掃描」「開銷 camera FAB」✅ → **P2 全 parity code 收齊待實機簽收**。
```

---

## 跟其他 spec 的關聯
- 上承 [`ios-port-master-plan.md`](./ios-port-master-plan.md)（P2 row + dep inventory + 風險）。
- web 行為基準：`pets-v2-rebuild.md`、`expenses-into-pets-page.md`、`per-pet-walk-goal.md`、`bug-receipt-ai-missing.md`。
- 下接 P3 Home+Feed（feed 用 P2c 的 image-picker/manipulator + P2 的 shared-i18n）。
- i18n 決策（D-i18n）影響全 surface → P3+ 沿用 shared-i18n。
