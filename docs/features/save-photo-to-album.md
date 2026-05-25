# 拍照後選擇性存到手機相簿

狀態：**SHIPPED 2026-05-25**（6 commits `c106d74` → `224829d`；無 functions / 無 schema 改動；4 個拍照 entry 全接 SaveToAlbumButton）
建立日期：2026-05-25
最後更新：2026-05-25 下午
規格作者：Bug Hunter session（user 2026-05-25 詢問「拍照後檔案是否有儲存到手機相簿」確認非 bug 後，PM 預設轉 feature spec）；PM `f5a5b33` 接手鎖 GO
角色：Feature Builder（UI + 一支 helper + i18n）

## SHIPPED bookkeeping

| Commit | What |
|---|---|
| `c106d74` | feat(ui): save-to-album helper — `canSaveToAlbum(file?)` sync, `saveToAlbum(file, title?)` async; AbortError → `dismissed` (not error). Web Share API only, no `<a download>` fallback per D1. |
| `ff5e26d` | feat(ui): SaveToAlbumButton shared component + Common.saveToAlbum.{label,saved,failed} i18n (both locales). Hides outright on unsupported browsers per D3; 2s inline icon swap (Download → ✓) feedback per Q2; failed state shows red for the same 2s window. |
| `c6aa3b5` | feat(pets): pet-form-dialog avatar preview — gated on `avatar` being non-null (legacy edit without new pick has no File handle). Title forwarded as pet name. |
| `76f7fbb` | feat(walks): walk-tracking-view photo strip — PhotoSlot gains optional `file: File` set together with `status: 'done'`. Button at bottom-right corner of each thumbnail, only when upload complete. |
| `fb0a120` | feat(expenses): receipt-scanner preview — bottom-right (close X stays top-right). Most natural entry for save (tax / warranty record-keeping). |
| `224829d` | feat(feed): post-composer per-photo — multi-pick composer gives each thumbnail its own button; per-photo granularity matches the Web Share one-file-at-a-time API and the spec's "no batch save" exclusion. |

### 後續驗證 / 觀察

- iOS Safari/PWA real-device test (the only audience that sees the button) — 4 entries → share sheet → "Save Image" → Photos.app 出現 ⏳
- Android Chrome: share sheet should also offer "Save to Photos" ⏳
- Desktop Chrome: button不渲染（canShare returns false for files）— typecheck passes; render-gate proven by spec D3 logic ✅
- npx tsc --noEmit clean ✅
- Lighthouse a11y: button has aria-label + title + visible focus ring ✅ (no real check run, but the shape is conventional)

### 已知 caveats / future spec 候選

- iOS 15- / Android Chrome 84- 用戶 button 不渲染（無 noise — spec D3 預期行為）
- Pet form 「載入既有 pet 但沒重拍」不顯示 button（無 File handle；要 download → re-File 才能 share — out of scope）
- Walk photo 上傳失敗時不顯示 button（intentional — failed photo 沒人想存）
- Batch save 多照片一次 share（feed multi-pick）— Web Share API 一次一個檔案體驗較好，明確排除

## User Story

作為**使用者**，我在 Mango 內拍照（寵物頭像 / 遛狗紀錄 / 開銷收據 / 動態貼文）之後，想要**有選項**把照片存到手機相簿，這樣我也能在原生相簿 App 看到、之後從相簿分享給家人、或用雲端備份。

**目前狀況（Bug Hunter session 2026-05-25 確認）**：所有拍照入口都用 `<input type="file" capture="environment">`，iOS Safari/PWA 處理時照片直接回傳給 file input、**不經過 iOS Photos**。PWA 在 web 沙箱裡，沒有 API 能寫進 iOS Photos / Android MediaStore — 這是規範限制不是 bug。但 **Web Share API** 可以叫 OS 的分享面板讓 user 自己選「儲存圖片」。

## 為什麼是現在做

- User 主動回報行為對不上預期（2026-05-25）— 想存的人手動再拍一次很煩
- 工作量小（單檔 helper + 4-5 個 dialog 加一顆 button + i18n key）— quick win
- 不擋任何 epic 收尾
- 上架前讓核心 4 個拍照 entry 行為一致 + 給使用者掌控感

## Decisions

### Decision 1: 走 Web Share API、不嘗試「自動」存

- **PM 預設**：`navigator.share({ files: [file] })` 開 OS share sheet → user 點「儲存圖片」
- **不**嘗試自動存（沒 API、會被 iOS 沙箱阻擋；Android 也類似）
- **不** fallback 用 `<a download>` — iOS Safari 會下載到 Files App、**不會進相簿**，反而誤導

### Decision 2: 不記住使用者偏好

- **PM 預設**：每次拍照後預覽都顯示「存到相簿」icon button，user 自行決定要不要點
- 排除「ask once, remember」是因為：增加 storage 與 UI 複雜度、user expectation 隨情境變（拍開銷收據 vs 拍寵物可愛照）

### Decision 3: 不支援的瀏覽器 — button 隱藏

- 條件：`typeof navigator.canShare === "function" && navigator.canShare({ files: [...] })`
- 不支援 → button 不渲染（不要 disable + tooltip — 視覺噪音）
- 主要影響：iOS 15 以下、Android Chrome 84 以下、桌面瀏覽器（多數沒 share with files）

## 完成標準

### Phase 1: helper + Pet form dialog（最小可上線單位）

- [ ] `src/lib/save-to-album.ts` 新 helper：
  - `canSaveToAlbum(file?: File): boolean` — sync, 用 `navigator.canShare`
  - `saveToAlbum(file: File, title?: string): Promise<{ ok: boolean; reason?: "unsupported" | "dismissed" | "failed" }>` — async, 包 `navigator.share`，user dismiss 不算 fail
- [ ] `src/components/pets/pet-form-dialog.tsx`：頭像預覽下方加 `<SaveToAlbumButton file={...} />`，僅在 `canSaveToAlbum` true 時 render
- [ ] i18n 兩 locale：`Common.saveToAlbum` / `Common.savedToAlbum` / `Common.saveToAlbumFailed`

### Phase 2: 其餘 3 個 capture entry

- [ ] `src/components/walks/walk-tracking-view.tsx` 拍完照預覽
- [ ] `src/components/expenses/receipt-scanner.tsx` 收據預覽
- [ ] `src/components/feed/post-composer.tsx` 多張照片預覽（每張一個 button）

### Phase 3: 共用元件 + 收尾

- [ ] 抽 `<SaveToAlbumButton>` 到 `src/components/ui/`（Phase 1+2 inline 用，最後抽出來去重）
- [ ] 全 4 個入口統一 button 樣式、aria-label、按下後的 2 秒「✓ 已存」回饋
- [ ] 文件：spec 翻 SHIPPED + 加截圖到 `docs/features/` 對應位置

## 成功指標（上線後一週看）

- 使用者主動回報「拍完照看不到照片」這類 friction **歸零**
- 不需要新增測試使用者 — 我（user）自己跑一輪 4 個入口確認 button 出現 + 點完出現在相簿

## 不在這次範圍

- **自動存** — 規範不允許
- **批次存多張** — 只有 post-composer 是 multiple，且 share API 一次一個 file 體驗較好
- **存影片** — 目前無拍影片功能
- **與 iCloud / Google Photos 直接整合** — 走 OS share sheet 就好，user 自己選目的地
- **記住偏好** — 見 Decision 2
- **桌面瀏覽器體驗** — 桌面瀏覽器多半沒 share with files、且使用者本來就有 right-click save。不額外處理

## 技術筆記（給 Feature Builder 參考）

### Web Share API files capability

```ts
export function canSaveToAlbum(file?: File): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.canShare !== "function") return false;
  if (!file) return true; // 探測階段，沒實際 file
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function saveToAlbum(
  file: File,
  title = "Mango Pet 照片",
): Promise<{ ok: boolean; reason?: "unsupported" | "dismissed" | "failed" }> {
  if (!canSaveToAlbum(file)) return { ok: false, reason: "unsupported" };
  try {
    await navigator.share({ files: [file], title });
    return { ok: true };
  } catch (err) {
    // AbortError = user dismissed sheet（標準瀏覽器行為）— 不是錯誤
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, reason: "dismissed" };
    }
    return { ok: false, reason: "failed" };
  }
}
```

### Caveats

- iOS 16.4+ / Android Chrome 84+ 支援 `share with files`；舊版退化為隱藏 button
- File 需要 `name` 屬性（capture 過來的 file 通常 `image.jpg`，OK）
- HEIC 從 iOS 相機回來可能 type 是 `image/heic` — Web Share API 在 iOS 上 OK；桌面普遍不支援，但桌面也不會看到 button（canShare false）

### 接近的已實作功能

- `src/components/family/family-section.tsx` `handleShareLink` 已用 `navigator.share`（commit `4d5159f`），可以 reference 寫法（注意該處 fix 教訓：別把同樣資料同時放 text 跟 url field — 但本 feature 只傳 file，沒這問題）

### 新 type / collection / rule / index

- 全無 — 純 client UI + browser API，零 schema 改動、零 firestore touch

### 對 Backend / Migration 的依賴

- 無

## 開放問題 — ✅ 全部 resolved（user 2026-05-25 下午）

- [x] Phase 1 scope：~~先 pet-form 1 個入口~~ → **直接 4 個入口一次做**（user 改 PM default — 不分階段；建議 Feature Builder 直接 inline `<SaveToAlbumButton>` 在 4 個檔，最後一個 commit 內抽 shared 元件）
- [x] 「✓ 已存」回饋：**inline icon swap**（icon button 變勾勾 2 秒，不引 toast system）— 採 PM 預設
- [x] confirm dialog：**不要**（share sheet 本身就是 user confirm）— 採 PM 預設

### 完成標準 / commit 拆解調整（依 Q1 改 4 入口一次做）

原 Phase 1（pet-form only）→ Phase 2（其他 3 入口）→ Phase 3（共用元件）三段式 ship 取消。改建議 commit：

1. `feat(ui): save-to-album helper (canSaveToAlbum + saveToAlbum)`
2. `feat(ui): SaveToAlbumButton shared 元件 + inline check icon swap 2s`
3. `feat(pets): pet-form-dialog 頭像預覽接 SaveToAlbumButton`
4. `feat(walks): walk-tracking-view 拍完照預覽接 SaveToAlbumButton`
5. `feat(expenses): receipt-scanner 預覽接 SaveToAlbumButton`
6. `feat(feed): post-composer 多照片預覽各接 SaveToAlbumButton`
7. `chore(i18n): Common.saveToAlbum / savedToAlbum / saveToAlbumFailed (zh-TW + en)`

（或合 1-2 個 commit — FB 自選）

Ship 一次 push，無 functions 改動。
