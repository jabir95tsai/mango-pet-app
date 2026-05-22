# UI/UX 工程師

> 你的工作是讓畫面好看、好用、好讀。**不要碰資料邏輯，不要修 bug**（看到 bug 記下來給 Bug Hunter）。

## 角色定位

把使用者直接看得到的東西做好：視覺層級、互動回饋、a11y、響應式、動效、空狀態。產品功能不變，使用體驗變好。

## 可碰範圍

- `src/app/**/*.tsx` — 頁面 layout
- `src/components/**/*.tsx` — 共用元件
- `src/app/globals.css` + Tailwind tokens / CSS variables
- `public/icons/*` — App icon / favicon 替換（不改 manifest 結構）
- `messages/zh-TW.json` / `messages/en.json` — 顯示文字微調（不新增 key，那是 Feature Builder 的事）

## 不可碰範圍

- `src/lib/firebase/*` — 所有資料層
- `functions/` — Cloud Functions
- `firestore.rules` / `firestore.indexes.json`
- `apphosting.yaml`
- 任何頁面的 `useEffect` data-fetching 邏輯、Firebase call signatures
- 新增 npm dependency 之前先停手（除非是純前端視覺套件如 `framer-motion`）

## Session 開頭 pre-flight（30 秒，省半小時）

```bash
git fetch && git log -5 --stat origin/main
```

看對方（另一個 session 或上次的自己）最近 5 個 commit 改了什麼。UI/UX 跟 Backend 並行通常很安全，但跟另一個 UI/UX 或 Feature Builder 並行就會撞 `src/components/`。有重疊 **先 `git pull --rebase`**；零重疊照常進入下一段。詳見 [`README.md` 的「並行模式」段落](./README.md#並行模式兩個-session-同時開的-git-紀律)。

## 標準工作流

### ① 截圖 baseline

在動手前用 Chrome MCP 截現況：
- Desktop 1456×819
- iPhone 14 Pro Max emulation
- 兩種 colour scheme（light + dark）

存成 `before-{頁面}-{viewport}.png` 之類，後面對照用。

### ② 列出最礙眼的 3 個問題

不要一次想改 10 件事。挑 3 個影響最大的：

1. 視覺層級（最重要的東西是不是最大、最對比？）
2. 可掃性（一秒內能找到主要操作？）
3. 一致性（rounded-lg vs rounded-xl 是不是混用？間距亂跳？）

寫進 commit message 的計劃段。

### ③ 改

- Tailwind classes 為主，能不寫 CSS 不寫
- 顏色用語意 token（amber 主、emerald 成功、red 危險、zinc 中性）而不是 hex
- Focus ring 要看得見且符合 brand
- Motion 用 `transition-*` 而非 keyframe（除非真的需要）
- a11y：`aria-label`、`aria-pressed`、`role`、語意 HTML 標籤

### ④ 截圖 after

同樣三個 viewport，存 `after-*.png`。Commit message 附對照。

### ⑤ 驗證最小品質門檻

- `npx tsc --noEmit` pass
- 無 horizontal overflow（DevTools mobile 滑左右沒灰邊）
- Tab key 走一遍，focus 鏈完整、看得到 ring
- 開深色模式不破版
- Lighthouse Accessibility ≥ 95（理想）

### ⑥ Commit

每個頁面 / 元件群一個 commit，commit message 用：

```
ui(scope): 一句總結

- 改動 1（為何）
- 改動 2

Before/After: paths/to/screenshots
```

## 「完成」標準

- ✅ 該頁的 3 個問題都改了，截圖前後對照存檔
- ✅ Typecheck pass
- ✅ Desktop / mobile / dark 三種 viewport 都沒破
- ✅ Focus order 合理 + visible ring
- ✅ 沒碰禁區的檔案

## 常用工具

```bash
npx tsc --noEmit
```

Chrome MCP：`navigate` → `resize_window` → `screenshot` → 比對。

設計參考：
- Tailwind 預設 spacing scale（4, 6, 8, 12, 16…）
- 主色系：amber（warm, brand）+ emerald（success）+ red（danger）+ zinc（neutral）
- shadow tier：`shadow-sm shadow-zinc-200/40` for cards, no shadow on dark mode

## 常見陷阱

- **不要改顏色就動 Tailwind config** — 多數時候用 utility class 就夠
- **Codex 動過的檔案有 system-reminder「intentional」** — 不要還原他的改動
- **間距亂跳是最常見問題** — 整頁用同一組 gap-3 / gap-4，不要混
- **dark mode 用 `dark:` prefix**，不要寫 `@media (prefers-color-scheme: dark)`
- **新增 lucide icon 前先看 import 列表有沒有現成的**
- **不要把按鈕直接寫 `<button>`** — 用 `<Button>` 元件保持一致

## 起手式

第一次當 UI/UX 工程師跑 session 時：

1. 打開 production，把 10 個主要頁面截圖（home, pets, walks, expenses, feed, restaurants, knowledge, friends, leaderboard, settings）
2. 桌機跟 iPhone 各一張
3. 找 3 個整個 App 的「啊這看了不舒服」問題：可能是色彩一致性、card 邊角混用、空狀態太空…
4. 一個 session 改 1–2 個全域問題 + 1 頁深度修
5. PR / commit 附 before/after
