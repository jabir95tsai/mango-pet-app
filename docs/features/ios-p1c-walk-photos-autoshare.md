# iOS P1c — Walk Photos + Auto-Photo-Share (ship note)

狀態：**CODE DONE + tsc pass / 待實機驗收**
建立日期：2026-06-01
角色：**iOS Feature Builder**
上承：[`ios-p1-walks.md`](./ios-p1-walks.md) P1c + [`walks-auto-photo-share.md`](./walks-auto-photo-share.md)；P1c backend `ios-p1c-photo-upload`（photos/posts/createWalk walkId）
parity：[`ios-parity-checklist.md`](./ios-parity-checklist.md) §A P1

## 做了什麼（全部 `apps/ios/**`，無新 dep — 用 Backend 已裝的 expo-camera / expo-image-manipulator）

### 1. 遛狗中拍照（≤5）
- `components/walks/camera-capture-modal.tsx`：`expo-camera` `CameraView` 全螢幕拍照（shutter + 關閉），`useCameraPermissions`；**拒權 fallback**（顯示說明 + 略過，仍可完成 walk）。
- `WalkTrackingView` tracking 階段加 📷 + 縮圖列：拍 → `uploadWalkPhoto(uri, uid, walkId, idx)`（Backend helper，內含壓縮）→ 進 `photoURLs`（上限 5，可不刪）；存檔 `createWalk({ ..., walkId, photoURLs })`。

### 2. START 自動發動態
- WalksHome CTA → `newWalkId()` 預先 mint `pendingWalkId`（對齊 web mintWalkId）。
- `autoPhotoShare` 開（預設 ON，讀 `users/{uid}.walkPrefs.autoPhotoShare !== false`，對齊 web）→ `PhotoShareFlow(start)`：`PhotoPromptSheet` → 拍照 → `PostComposer`（initialPhoto + 預設文案 + **walkId=pendingWalkId**）→ `createPost`；略過/拒權 → 直接進 tracking。發完文也進 tracking。

### 3. END 自動發動態
- done screen 儲存成功後（walk 已落地 = `pendingWalkId`）→ `autoPhotoShare` 開 → `PhotoShareFlow(end)`：prompt → 拍照 → `PostComposer`（end 預設文案 + **walkId=pendingWalkId**）→ `createPost`；略過 → 關閉。
- **START / END 兩 post 同一個 walkId cross-link**（= 該 walk 的 id）。

### 4. 元件
- `components/walks/photo-prompt-sheet.tsx`（bottom sheet，start/end 文案，拍照/略過，backdrop=略過）。
- `components/feed/post-composer.tsx`（文字 + 照片 ≤4 經相機加 + 寵物標記 + 能見度**預設公開** → `createPost`，內部壓縮上傳）。
- `components/walks/photo-share-flow.tsx`（orchestrator：prompt→camera→composer，start/end 共用，每個離開路徑都 `onDone`，walk flow 不卡）。
- 資料：`walk-data.getAutoPhotoShare(uid)` + `use-walks-data` expose `autoPhotoShare`。

## 驗證了什麼
- ✅ `npm run typecheck -w @mango/ios`（tsc --noEmit）pass。
- ✅ change surface 僅 `apps/ios/**` + 本 ship note；**未動** apps/web / packages/* / functions / rules / indexes / **package.json / lockfile** → **無新 dep**（相機/壓縮為 Backend 前置）→ 不需 native/App Hosting gate。
  - ⚠️ 注意：commit 時工作樹另有**他人未提交**的 `apps/web` / `functions` / `firestore.rules` 改動（並行 session），**我沒碰、沒 commit**，只 `git add` 我的 `apps/ios` 檔。
- ⏳ **實機驗收未跑**（Windows 無相機/simulator）。需 Backend 那棒的含相機 EAS build：(a) 遛狗中拍照≤5 上傳 walk.photoURLs；(b) START 拍照→post(walkId=pending)、END 拍照→post(walkId=saved)，兩 post 同 walkId；(c) 相機拒權 fallback 不崩、仍能完成 walk。

## ⚠️ 刻意取捨 / 已知限制
- **walk 照片刪除只移除陣列、不刪 Storage**（孤兒檔，成本極低）；如要清理 = 之後另案。
- **END prompt 在「儲存」之後**才出現（非 web 的 done-1s auto-overlay）；資料語意一致（同 walkId），UX 微調可由 UI/UX 對齊。
- i18n 仍 **inline zh-TW**（shared-i18n 仍未建）。

## 🤝 Handoff
### → iOS PM
- P1c code 完成、tsc 過、**零新 dep**，**待 iPhone 驗收**。parity §A P1 兩列可標進度（驗一趟後 ✅）：**「Walk 拍照 + Storage 上傳」「遛狗自動拍照 + 自動發動態（start/end）」** → **P1 全 parity 收齊**。
- autoPhotoShare 的 **toggle UI 仍在 P5 settings**（本棒只讀 pref，預設 ON）。

### → iOS UI/UX（walks polish pass 納入）
- 拍照 UI（CameraCaptureModal 構圖/快門）、PhotoPromptSheet、PostComposer 視覺對齊 web mango；END prompt 出現時機（auto vs 儲存後）對齊。
- walk 照片縮圖列、composer 照片 grid polish。

### → iOS Backend
- （沿用）pure stat helpers 收進 `@mango/shared-business`（drift）；walk 照片孤兒清理若要做另案。

### 下一步
- **P1 收齊 → iOS UI/UX walks polish pass（已排程）**。
- **shared-i18n**：P1a–P1c 全 inline zh-TW；建議 UI/UX polish 或 P3 feed 時一次起 `@mango/shared-i18n`，收斂 Walks/Post/Photo namespace，消 zh-TW/en drift。
