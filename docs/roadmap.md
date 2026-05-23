# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-23（家庭 epic CLOSED；開新 epic「上架收尾 + backlog P2」5 項全部 ready-for-dev）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **上架收尾 + backlog P2 epic** — 5 項，2 條 spec 新寫好，3 條沿用既有 backlog 條目
  - 👉 **下個動工**：見「Handoff 順序」（下方）

## 上架收尾 + backlog P2 epic

> User 主動選定（2026-05-23）：「『資料 export』+『PWA icons』並處理 backlog 殘留 P2」

| # | 項目 | 工作量 | 角色 | 狀態 | Spec / Backlog ref |
|---|---|---|---|---|---|
| 1 | **PWA icons** | S | User / UI/UX | 📝 ready-to-do | 用 [realfavicongenerator.net](https://realfavicongenerator.net) 從 SVG 生成 PNG 完整套組 → 放對應 public/ 路徑（無 spec — 純 asset 生成）|
| 2 | **Footer i18n 硬編碼** | XS | Feature Builder | 📝 ready-to-do | 既有 backlog 條目（`/app/page.tsx` L65/L68 寫死中文，加 i18n key + getTranslations 即可）|
| 3 | **PushToggle cross-context token bug** | S | UI/UX or FB | 📝 ready-to-do | 既有 backlog 條目（push-toggle.tsx probe 主動 getToken 補當前 context FCM token）|
| 4 | **[資料 Export — Download my data](../features/data-export.md)** | M | Feature Builder | ✅ **READY-FOR-DEV**（PM 寫好 5 個決策預設）| 新 spec |
| 5 | **[好友搜尋 lowercase / prefix match](../features/friends-search-lowercase.md)** | M | Backend | ✅ **READY-FOR-DEV**（PM 升級 backlog 條目）| 新 spec |

**為什麼這個 epic**：

- **PWA icons + Footer i18n + PushToggle bug** — 3 個 quick wins，total 工作量 < 半天，是上架前/體驗 polish
- **資料 Export** — 對稱於 delete-account（forget me ↔ give me my data），GDPR 平行條件
- **好友搜尋 lowercase** — backlog 條目從 2026-05-22 拖到現在，user 願意做了；社群人數還小 schema migration 成本最低

## Handoff 順序建議

```
User 自己做 PWA icons (5 分鐘 asset 工作)
  ↓
Feature Builder session #1: footer i18n + PushToggle bug + data-export (一條龍 ~半天)
  ↓
Backend session: friends-search-lowercase
```

或更激進的並行：
- User: PWA icons
- FB session A: footer i18n + PushToggle bug (S+S = 2 small)
- FB session B: data-export (M, standalone)
- Backend session: friends-search-lowercase (M, standalone)

4 個 session 平行不衝突（不同檔案範圍）。

## 🎉 家庭功能 epic — 完整收尾紀錄（2026-05-22 → 2026-05-23）

| # | 項目 | 工作量 | 角色 | 結局 | Ship commit |
|---|---|---|---|---|---|
| 1 | [Reminder 完成歸屬顯示](../features/reminder-done-attribution.md) | S | Feature Builder | ✅ SHIPPED | `ec8c6fd` |
| insert | [刪除帳號功能](../features/delete-account.md) | M | Feature Builder | ✅ SHIPPED + user-verified | `d5ade48` (+4 follow-ups) |
| 1b | [Repeat reminder 歸屬顯示](../features/repeat-reminder-attribution.md) | S | Feature Builder | ✅ SHIPPED | `3282091` |
| 2 | [家庭 onboarding 重設計（解 B）](../features/family-onboarding-redesign.md) | L | Feature Builder | ✅ 全部 SHIPPED（B1-B3 + B4 rollback） | `60d820c` / `8ebcf72` / `347d71a` / `1a49653` |
| 3 | [家庭 leaderboard 切換](../features/family-leaderboard.md) | M | Feature Builder | ✅ SHIPPED（Phase 0 + 主體） | `32c4feb` + `37ac063` |
| ~~4~~ | Mango dedupe migration | M | Backend | ❌ NOT DOING（user 取消） | — |
| ~~5~~ | 開銷 payer 分析卡 | S | UI/UX | ❌ NOT DOING（user 取消） | — |
| 6 | [Legacy 路徑清理](../features/legacy-path-cleanup.md) | M | Backend | ✅ SHIPPED | `1e380b7` |
| insert | Mobile bottom nav 重組 | S | UI/UX | ✅ SHIPPED | `e34640a` |

**結算**：6 ship + 2 cancel + 2 insert = **8/8 有明確結局**

Epic 期間 PM 觀察 / 學到的事（5 點）：
1. 不要把 edge case 當核心 user story 推導（B4 merge / #4 dedupe）
2. 「家庭是 optional feature」product principle（解 B personal mode）
3. PM 義務 push back 當 user choice 跟 description 對不上
4. Spec deviation 記錄文化
5. Insert / 插隊管理（surface trade-off 再做）

## 下一個（已規格化，可直接交付）

> 上架收尾 epic 進行中，此段目前無 backlog 項目。

## 想做但還沒規格

> 想法階段。上架收尾 epic 完工後決定。

- **餐廳 Google Places 整合**：目前餐廳僅手動建。Places API 可大幅擴大資料庫，但成本與審核機制要先想
- **知識庫持續產出**：目前只 seed 5 篇。要每月持續產出 1–2 篇還是放著？需要 PM 決策
- **Analytics / 北極星指標接線**：定性觀察不夠，要決定接 GA4 / Firebase Analytics / 自己開 minimal events collection
- **自訂網域 + DNS**（PRD §6）：要花錢買網域，user 決定後再 spec
- **App Check 防 API key 盜用**（PRD §6）：上架後續，等使用者數成長再做
- **Lighthouse audit > 90**（PRD §6）：PWA / Perf / SEO 三軸 polish
- **隱私 / 服務條款內容審查**（PRD §6）：PM 寫內容

## 不做（拒絕清單）

> 比「做」更重要。寫下來防止反覆討論同一件事。

- **Web 內背景 GPS 解決方案**
- **AI 寵物顧問聊天**
- **私訊系統**
- **訂閱付費 / 廣告**（DAU 上百之前不討論）
- **強迫所有使用者必須建立家庭才能使用主功能**（PM 解 C 提議 2026-05-23 已被否決）— 違反「家庭是 optional feature」
- **加入家庭時自動 pet merge wizard**（B4 ship 後 2026-05-23 拿掉）— 使用者：「不直觀，因為一般不太有這種狀況」
- **刪帳號時 anonymize 共用資料**（2026-05-23 改 full hard delete cascade）
- **同 family 內同名 pet 合併 / dedupe migration**（#4 2026-05-23 取消）— 罕見情境
- **開銷 payer 分析卡**（#5 2026-05-23 取消）— 家庭 ≤ 5 人總額足用

## 北極星指標（每月看一次）

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率

> 還沒接 analytics — 目前只能定性觀察。**接 analytics 這件事本身已進入「想做但還沒規格」**，等下個 PM session 決定要不要這個 sprint 規格化。
