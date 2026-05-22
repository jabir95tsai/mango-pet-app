# Backlog

> 跨角色的「之後再處理」清單。每個角色 session 看到不在自己範圍的事，**寫進這裡再繼續做手上的事**，不要當下分心去修。

## 怎麼用

- 寫入：Bug Hunter、UI/UX、Feature Builder、Backend 在 session 中遇到不該動的事，丟一條進這裡。
- 讀出 / 排序：每個 PM session 開頭看一次，分類、合併、決定下次哪些升到 `docs/roadmap.md`。
- 不要把這裡當 GitHub Issues 用 — 一旦超過 30 條就停下來做一輪 PM session 清理。

## 條目格式

每條一個 H3，照模板填：

```
### [簡短一句話標題]
- **發現於**：YYYY-MM-DD、哪個角色 session
- **類型**：bug / 體驗 / 技術債 / 新功能想法 / 設計
- **重現 / 觀察**：(怎麼觸發到 / 在哪裡看到)
- **建議交付給**：Bug Hunter / UI/UX / Feature / Backend / PM
- **優先級提示**：P0(立即) / P1(下個 sprint) / P2(可等) / P3(也許永遠)
```

P0 = 使用者資料/安全/錢有風險。
P1 = 影響核心功能體驗。
P2 = 小痛點。
P3 = 也許永遠不做的「想法」。

---

## Inbox（未分類）

> 新進來的條目都放這。PM session 會搬到下方分類區。

### [範例] 重複的 Mango pet
- **發現於**：2026-05-21、Bug Hunter session
- **類型**：bug / 資料殘留
- **重現 / 觀察**：`/app/pets` 顯示兩隻 Mango，因為 legacy 路徑曾建立兩次，
  migration 忠實搬了過來
- **建議交付給**：Bug Hunter（手動刪一隻即可）或 Backend（寫去重 migration）
- **優先級提示**：P2
- **狀態**：✅ 已升級 → `docs/features/mango-dedupe-migration.md`（PM 2026-05-22）。保留條目當教學範例。

---

## 已分類 — Bug Hunter 接

（PM session 從 Inbox 搬過來）

_目前沒有條目。下一個 PM session 過 Inbox 時新增。_

---

## 已分類 — UI/UX 接

_目前沒有條目。下一個 PM session 過 Inbox 時新增。_

---

## 已分類 — Feature Builder 接

_目前沒有條目。已規格化項目見 `docs/roadmap.md` 的「下一個」與 `docs/features/*.md`。_

---

## 已分類 — Backend 接

_目前沒有條目。已規格化項目見 `docs/roadmap.md` 的「下一個」與 `docs/features/mango-dedupe-migration.md`。_

---

## Deferred / 不做

> PM 決定不做的條目搬來這裡 + 寫理由。比刪掉好，下次有人想重提時直接擋下。

### [範例] 內建 QR scanner
- **理由**：iPhone / Android 原生相機都能掃 QR 並開 URL，App 內建 scanner
  增加 camera permission 摩擦 + bundle size，CP 值低。
