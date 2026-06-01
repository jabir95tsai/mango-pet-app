# 設定頁「我的照片」預覽

> **狀態**：✅ SHIPPED（commit `9643e07` ui(settings): latest-photos block + tidy language row）。本 spec 為 PM 事後補記（功能先實作、後補規格），含 user 2026-06-01 提供的成本備註。
> **歸屬**：照片圖庫（[`photo-gallery-downloads.md`](./photo-gallery-downloads.md)）的設定頁入口子功能。

## 功能

- 設定頁顯示「我的照片」最近 3 張縮圖，**tap-through 進 `/app/photos`** 完整圖庫。
- **取代**舊的 gallery icon 按鈕（從「一顆 icon」升級為「最近 3 張預覽 block」）。
- 元件：`apps/web/src/components/settings/photos-preview-section.tsx`（`PhotosPreviewSection`），接在 `settings/page.tsx`（帳號區下方、walks auto-photo toggle 上方）。
- 複用照片圖庫的 `listMyPhotoAssets`（`apps/web/src/lib/firebase/photo-gallery.ts`）。

## 成本備註（對齊控成本原則）

- 照片預覽用 `listMyPhotoAssets`，會**聚合查 posts / walks / pets / expenses**（與開啟照片圖庫頁同等讀取量），**每次進設定頁觸發一次**。
- **設定頁非高頻頁面，可接受**。
- 若日後想再省：可加一個輕量「**只取最近 N 張**」helper（需 Backend / 資料層支援，**跨此次範圍**）。

## 不在範圍 / 未來

- 「只取最近 N 張」的輕量 query（上述成本備註）— 之後若設定頁讀取量成為問題再開，需資料層支援。

## 驗收（已上線）

- 設定頁顯示最近 3 張照片縮圖；點任一張 / 區塊 → 進 `/app/photos`。
- 無照片時的空狀態（沿用元件處理）。
