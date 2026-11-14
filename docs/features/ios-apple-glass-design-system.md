# iOS Apple Glass 舊方案（封存）

狀態：**SUPERSEDED / ARCHIVED**。2026-10-10 起由 [iOS Liquid Glass 現行規格](./ios-liquid-glass.md) 取代；品牌與動效規則以 [設計系統](../design-system.md) 為準。本文件不是待實作規格，也不是 v1.1 開發計畫。

舊方案使用 `expo-blur`，規劃把卡片、頁首、sheet 等 surface 改成毛玻璃。現行方案使用 SDK 57 的原生 `expo-glass-effect`：底部浮動導覽與頁內切換鏡片，內容卡片／列表／頁首／主鈕維持實心 mango。

## 保留的歷史事實

- 舊分支的 PWA 對齊內容（導覽、遛狗 CTA、排行榜、設定與共用 danger tokens）已由 `ef57b20` 分拆整合。
- 未納入 main 的 8 個 `Glass*` 元件、舊材質 tokens、`useReduceTransparency` 與 `expo-blur` 依賴屬於已取消方案，現行 App 無引用，不需搬回。
- `ios-glass-blur`（末端 `8ce0e3e`）於 2026-11-14 審查後刪除本機及遠端分支。舊原型完整歷史備份於本機 `outputs/branch-cleanup-20261114/branches.bundle`（gitignored，非遠端共用檔）。
- 新版的 iPhone 原生效果與輔助使用驗收仍待既定 phase 批次確認，不能用刪除舊分支或通過建置代替實機驗收。
