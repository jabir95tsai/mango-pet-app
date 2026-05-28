# 照片圖庫 + 照片儲存

狀態：**SHIPPED 2026-05-27**（Feature Builder `e76f97c`；`/app/photos` + downloaded state + nav/settings entry）
建立日期：2026-05-27
最後更新：2026-05-28 PM status sync
規格作者：PM session
角色：**Feature Builder**（新頁面 + Firebase read helpers + share/download helper + i18n）；只有新增 rules / indexes 時才交 Backend
工作量：**M**

## SHIPPED bookkeeping

| Commit | What |
|---|---|
| `e76f97c` | Personal photo gallery downloads：`/app/photos` route, `src/components/photos/*`, `src/lib/photo-download.ts`, `src/lib/firebase/photo-gallery.ts`, nav/settings entry, `Photos.*` i18n, and `users/{uid}/photoDownloadState/{assetId}` rules. |

### 後續驗證 / 觀察

- Production / iOS PWA：單張、多張、一鍵儲存尚未下載照片。
- Desktop fallback：Blob download file name reasonable。
- Refresh 後 downloaded state 不再計入未下載。
- Existing receiptURL 會顯示；新收據原圖持久化仍是 v2 follow-up，不在本次 scope。

## User Story

作為**使用者**，我想在 Mango Pet 裡看到自己拍過、上傳過的照片集中成一個「照片圖庫」，並且可以把單張、多張、或全部尚未儲存過的照片存到手機相簿，這樣我不用回頭翻動態、遛狗紀錄或寵物資料，也能把重要照片備份、轉傳給家人，或留在手機相簿。

## User Q&A（2026-05-27 confirmed）

- Q1「照片圖庫」與「拍照後可以存到手機」要哪個？→ **都要**。
- Q2 v1 照片來源？→ **動態照片、遛狗照片、寵物頭像、收據照片**。餐廳評論照片先不列入 v1。
- Q3 圖庫範圍？→ **只看自己拍 / 自己上傳的照片**。
- Q4 下載方式？→ **單張下載 + 一次下載多張**，且目標是**存到相簿，不是存成 Files 裡的檔案**。
- Q5 收據照片是否要先補持久化？→ **先不用**。v1 可顯示已存在的 `Expense.receiptURL`，但不把 ReceiptScanner 持久化列為本次完成門檻。
- Q6 入口？→ 採 PM 預設：`/app/photos`，desktop sidebar / mobile drawer，不塞 bottom nav。
- Q7 點圖體驗？→ 採 PM 預設：沿用 PhotoLightbox，加下載 / 儲存動作。
- Q8 成功畫面？→ 進照片圖庫看到最近的遛狗照 / 動態照 / 收據照，點開可存回手機或下載；另外要有**一鍵全部下載尚未下載過的照片**。

## 現況

- `save-photo-to-album.md` 已 SHIPPED：拍照當下若仍有 `File` handle，可以用 Web Share API 叫出 OS share sheet 讓 user 自己「儲存影像」。
- `photo-lightbox.md` 已 SHIPPED：feed + walks 已能點圖放大，但 lightbox 原 spec 把 download/share button 排除。
- `data-export.md` 已 SHIPPED：只 export photo URL，不下載 binary。
- 目前已持久化的 v1 照片來源：
  - `Pet.photoURL`：寵物頭像，Storage path 走 `users/{uid}/pets/{petId}/avatar.{ext}`。
  - `Post.photoURLs[]`：動態貼文照片，Storage path 走 `users/{uid}/posts/{postId}/{idx}.{ext}`。
  - `Walk.photoURLs[]`：遛狗中拍的照片，Storage path 走 `users/{uid}/walks/{walkId}/photos/{idx}-{ts}.{ext}`。
  - `Expense.receiptURL?`：type 已存在；若資料中已有 receipt URL，v1 要顯示。
- 收據掃描目前主要把照片送 AI OCR，`ExpenseInput` / `createExpense` 尚未把新收據照片持久化。依 Q&A，**本次先不用補持久化**，未來再另開 follow-up。

## Product Decisions

### D1: v1 做「我的照片」，不是家庭共享相簿

圖庫只收集目前登入者自己建立或拍攝的照片：

- 我發的 post 照片。
- 我完成的 walk 照片。
- 我建立 / 擁有的 pet 頭像。
- 我付款並已有 `receiptURL` 的 receipt 照片。

不把家人、好友、餐廳評論照片混進來。家庭共享相簿和餐廳相簿之後可以獨立做，避免 v1 權限語意太混。

### D2: v1 不新增 `photoAssets` collection

先從現有 documents 聚合成 client view model，不新建全域照片索引。

原因：
- 現有照片量小，從 posts / walks / pets / expenses 聚合足夠。
- 新 collection 會增加 rules、migration、delete-account cascade、資料一致性成本。
- 真正需要搜尋、批次管理、雲端備份時，再做 `photoAssets` v2。

建議 view model：

```ts
type GalleryPhotoAsset = {
  id: string;
  source: "post" | "walk" | "pet-avatar" | "expense-receipt";
  url: string;
  title: string;
  createdAt: Timestamp;
  sourceId: string;
  petId?: string;
  petName?: string;
  fileName: string;
};
```

### D3: 新 route `/app/photos`

頁面名稱：`照片圖庫 / Photos`

入口：
- Desktop sidebar / mobile drawer 加 `照片圖庫`，不要塞進 bottom nav。
- Settings 帳號區可加小 quick action，和朋友入口同層，讓使用者知道這是資料管理能力。

UI 形狀：
- RouteHeader：標題 `照片圖庫`，副文顯示照片總數與未儲存數。
- Top action：「儲存尚未下載的照片」。
- Filter chips：全部 / 動態 / 遛狗 / 寵物 / 收據。
- 2-column mobile grid、3-4 column desktop grid。
- 每張圖顯示來源 badge、日期、可選 pet name、已儲存狀態。
- 點圖開既有 `PhotoLightbox`，並在 lightbox 或底部 toolbar 提供「儲存」動作。
- Empty state：沒有照片時，引導「去發一則動態」或「開始遛狗拍照」，但不自動開相機。

### D4: 儲存到相簿優先，單張 + 多張都要

主要目標不是「下載到 Files」，而是讓照片進手機相簿。Web/PWA 的限制是：**不能無提示自動寫入 iOS Photos / Android MediaStore**。因此 v1 的產品語意是「開 OS share sheet，讓 user 明確點儲存影像」。

下載 / 儲存行為：

1. 單張：
   - fetch Firebase Storage URL -> Blob -> File
   - `navigator.canShare({ files: [file] })`
   - `navigator.share({ files: [file], title })`
   - user 自己在 share sheet 選「儲存影像」或傳給其他 app
2. 多張：
   - fetch selected URLs -> Blob[] -> File[]
   - 若 `navigator.canShare({ files })` 支援多檔，開一次 share sheet
   - user 自己在 share sheet 選「儲存多張影像」
   - 若多檔 share 不支援，退化成「逐張開 share sheet」流程，UI 清楚顯示第 N / total 張
3. Desktop / fallback：
   - fetch URL -> Blob -> object URL
   - transient `<a download>` 觸發 browser download
   - 檔名：`mango-pet-{source}-{sourceId}-{idx}.jpg`
   - 這是 fallback，不是 mobile 主路徑

注意：不要直接對 Firebase Storage cross-origin URL 用 `<a download>`，瀏覽器常會忽略檔名或改成開新分頁。先轉 Blob 才穩。

### D5: 一鍵全部下載尚未下載過的照片

Gallery 要有主 action：「儲存尚未下載的照片」。

產品語意：
- 「尚未下載」以 Mango Pet 內的紀錄為準，不偵測使用者手機相簿是否真的已有照片。
- 第一次成功完成 share/download action 後，把該 `asset.id` 標記為 downloaded。
- 單張下載成功也要標記。
- 多張流程若 user 中途取消，只標記已完成的照片。

PM 預設：
- v1 用 Firestore per-user state，而不是 localStorage，避免換手機後全部又變「未下載」。
- path：`users/{uid}/photoDownloadState/{assetId}`
- shape：`{ assetId, source, sourceId, urlHash, downloadedAt, mode: "share" | "download" }`
- `assetId` 要穩定：建議 `source + ":" + sourceId + ":" + idxOrKind`。

這可能需要 Firestore rules 允許 owner 讀寫自己的 `photoDownloadState` 子集合；若現有 `users/{uid}` 子集合通用 rules 沒 cover，Feature Builder 要交 Backend 或在同 scope 最小補 rules。

## 完成標準

### Phase 1: Aggregator + share/download helper

- [ ] 新 helper `src/lib/photo-download.ts`：
  - `downloadPhotoFromUrl(url, fileName): Promise<{ ok: boolean; reason?: string }>`
  - `shareOrDownloadPhotoFromUrl(url, fileName, title): Promise<{ ok: boolean; mode: "share" | "download"; reason?: string }>`
  - `shareOrDownloadPhotosFromUrls(assets): Promise<{ completedAssetIds: string[]; cancelled: boolean }>`
  - fetch fail / CORS fail / user dismiss 要有不同處理，dismiss 不算 error。
- [ ] 新 helper `src/lib/firebase/photo-gallery.ts`：
  - `listMyPhotoAssets(uid, familyId | null): Promise<GalleryPhotoAsset[]>`
  - posts：用 `listMyPosts(uid, max)`，只取 `photoURLs.length > 0`。
  - walks：personal 用 `listPersonalWalks(uid, max)`；family 用 `listWalks(familyId, max)` 後 filter `walkerUid === uid`。
  - pets：personal 用 `listPersonalPets(uid)`；family 用 `listPets(familyId)` 後 filter `ownerUid === uid`。
  - expenses：personal / family list 後 filter `payerUid === uid && receiptURL`。
  - 所有 assets 依 `createdAt` desc 排序，URL dedupe。
- [ ] 同 helper 讀寫 downloaded state：
  - `listDownloadedPhotoAssetIds(uid): Promise<Set<string>>`
  - `markPhotoAssetsDownloaded(uid, completedAssetIds, mode): Promise<void>`

### Phase 2: `/app/photos` UI

- [ ] 新 route `src/app/app/photos/page.tsx`。
- [ ] 新 components in `src/components/photos/`：
  - `photo-gallery-grid.tsx`
  - `photo-asset-card.tsx`
  - `photo-download-button.tsx`
- [ ] 使用既有 `PhotoLightbox`，或以最小改動加 optional download action，不破 feed / walks 現有 lightbox。
- [ ] Filter chips 可切 source；切換不 refetch，只在 client 篩。
- [ ] Top action：「儲存尚未下載的照片」：
  - 沒有未下載照片時 disabled，文案顯示「全部已儲存」。
  - 有未下載照片時顯示 count，例如「儲存 12 張新照片」。
  - 點擊後走多張 share/download 流程。
- [ ] 每張 card 顯示 downloaded 狀態：
  - 未下載：可顯示小 badge「新」。
  - 已下載：低調 check，不要搶主視覺。
- [ ] Loading / partial error state：
  - 某來源讀取失敗時，圖庫仍顯示其他來源照片。
  - 頁面下方顯示「部分照片暫時無法載入」。
- [ ] Empty state 不要像 marketing hero，保持 app tool surface。
- [ ] Nav：
  - `src/components/nav/app-nav.tsx` 加 photos nav key。
  - `messages/zh-TW.json` / `messages/en.json` 加 `Nav.photos` 與 `Photos.*` keys。
  - Bottom nav 不新增 slot。

### Phase 3: Multi-save state + permission/rules

- [ ] 成功儲存 / 下載後寫入 downloaded state。
- [ ] 一鍵全部下載只抓未 downloaded assets。
- [ ] 若 Firestore rules 未 cover `users/{uid}/photoDownloadState/*`，最小補 rules，並跑 `npx firebase deploy --only firestore:rules`；若 Feature Builder session 不碰 rules，寫 Backend handoff。
- [ ] 不把「使用者取消 share sheet」標成 downloaded。

### Phase 4: Validation

- [ ] `npx tsc --noEmit` pass。
- [ ] Local dev + Browser/Chrome MCP：
  - `/app/photos` 0 照片 empty state。
  - 有 post photo 的帳號：照片出現在「動態」，點開 lightbox，可儲存。
  - 有 walk photo 的帳號：照片出現在「遛狗」，點開 lightbox，可儲存。
  - 有 `receiptURL` 的 expense：照片出現在「收據」，可儲存。
  - 選多張 / 一鍵儲存未下載：支援平台一次開 share sheet；不支援時逐張流程可完成。
  - 完成後刷新頁面：剛儲存過的照片不再算未下載。
  - Mobile viewport：grid 不擠壓，download action 44px hit area。
  - Desktop fallback：download 產生實際檔案，檔名合理。
- [ ] App Hosting production 上線後 5-8 分鐘再驗 `/app/photos`。

## 成功指標

- 使用者能在 30 秒內找到自己最近拍的一張 walk 或 post 照片。
- 使用者能成功把至少一張已上傳照片透過 share sheet 存到相簿。
- 使用者能一次儲存多張照片，或在平台限制下完成逐張引導流程。
- 使用者能一鍵處理所有尚未下載過的照片，完成後清楚知道剩餘 0 張。

## 不在這次範圍

- 批次 ZIP 下載。
- 家庭共享相簿。
- 從 gallery 編輯 / 刪除照片。
- 本次補 ReceiptScanner 新收據原圖持久化（user Q&A 先不用）。
- 餐廳評論照片。
- AI 自動分類、寵物辨識、相似照片去重。
- 自動無提示寫入 iOS Photos / Android MediaStore（Web/PWA 不允許）。
- 舊收據照片回補 migration（舊資料本來沒有 binary，無法補）。
- `photoAssets` collection / background indexing。

## 關聯 spec

- `docs/features/save-photo-to-album.md`：拍照當下存到相簿，本 spec 解「之後從雲端照片再儲存」。
- `docs/features/photo-lightbox.md`：本 spec 補上 lightbox 曾排除的 download/share action。
- `docs/features/data-export.md`：資料 export 只含 URL，本 spec 是照片 binary 取得體驗。
- `docs/features/walks-photo-and-celebration.md`：walk `photoURLs[]` 是 gallery 的主要來源。
- `docs/features/expenses-into-pets-page.md`：receipt scanner 現在在 pets expenses flow 裡；新收據原圖持久化改列 follow-up，本次只讀已存在的 `receiptURL`。

## Feature Builder launch prompt

```text
本 session 固定角色：Feature Builder — 實作照片圖庫 + 已上傳照片單張/多張儲存。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

必讀：
- AGENTS.md
- docs/team/feature-builder.md
- docs/features/photo-gallery-downloads.md
- docs/features/save-photo-to-album.md
- docs/features/photo-lightbox.md
- docs/features/expenses-into-pets-page.md

範圍：
- 新增 /app/photos。
- 聚合我自己的 post / walk / pet avatar / existing receiptURL 照片。
- 新增從 Firebase Storage URL fetch Blob 後 share/download 的 helper；mobile 優先走 OS share sheet 存到相簿。
- 支援單張、多張、以及「一鍵儲存尚未下載的照片」。
- 增加 downloaded state，成功儲存後不要再算未下載。
- 加 i18n 與 nav entry，但 bottom nav 不新增 slot。

護欄：
- 不新增 photoAssets collection。
- 不做 batch ZIP；批次在 mobile 走多檔 share sheet，fallback 才逐張。
- 不做家庭共享相簿。
- 不做 receipt scanner 新收據持久化。
- 不納入餐廳評論照片。
- 不破既有 PhotoLightbox feed/walks 用法。
- 若發現需要 Firestore index / rules / delete-account cascade，先寫 handoff 給 Backend，不要順手大改。

完成前：
- npx tsc --noEmit
- local dev 驗 /app/photos desktop + mobile
- 單張儲存、多張儲存、一鍵儲存未下載都要驗
```
