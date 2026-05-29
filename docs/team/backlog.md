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

_2026-05-29 PWA PM session 已清空一輪：原 Inbox 10 條全 triage 完 — 4 條 SHIPPED/RESOLVED 收進「已處理（audit trail）」、1 條 doc-accuracy 當場修掉、2 條升到對應角色待接、3 條(QR scanner / B4 dormant / settings onboarding link)歸 Deferred。下一個角色 session 新發現的事丟這裡。_

---

## 已分類 — Bug Hunter 接

### `/join/{code}` 在 LINE→iOS Safari context 下偶發 React #300（推測已根治，待 user 驗）
- **發現於**：2026-05-25、Bug Hunter session
- **類型**：bug / 環境相依 / 未確認是否仍存在
- **✅ 2026-05-26 推測已根治**：真兇 = `src/app/app/walks/page.tsx` confetti `useEffect` 寫在 0-pet 早 return **之下**，hook count 38 vs 37 在 transition path mismatch → React #300。Fix `ad90acf` 把 useEffect 搬到早 return 上面。推測 5/25 `/join` 那次也是同條 — `/join` 自身 render tree 乾淨，撞的是成功 redirect 落地 `/app/walks` 的 cold-start race（loading false + pets [] 瞬間）。Desktop Chrome MCP 訪 `/join/123456` 無法重現；iOS UA spoof curl SSR 也正常。
- **建議交付給**：Bug Hunter（僅在 user 清完 PWA cache 重裝後仍復發才再開挖；若不復發 → 移到「已處理」關閉）
- **優先級提示**：待 user 驗證；不復發即關閉
- **PM 排序（2026-05-29）**：保留待 user 實機驗證。iOS P0 期間不動 `src/`，本條等 user 回報結果再決定關閉或重開。

---

## 已分類 — UI/UX 接

### walks-auto-photo-share：短 walk (< 1 min) 結束 prompt 顯示「走了 0 分」
- **發現於**：2026-05-26、Bug Hunter session（跑 0.4 分鐘 test walk 觸發）
- **類型**：體驗 / polish
- **重現 / 觀察**：`/app/walks` 開始遛狗 → [跳過] → 任意秒數 → 停止 → 1s 後 end prompt body「Mango 今天走了 0 分，留個紀念」。只在 walk durationMinutes < 1 觸發。Root：`WalksPhotoPrompt.captionEndDefault` interp `{min}` 拿到 `Math.floor(seconds/60) = 0`。
- **建議交付給**：UI/UX（i18n copy）或 Bug Hunter（一行 `Math.max(1, Math.floor(...))` 或 `Math.round`）
  - 改點：`src/components/walks/walk-tracking-view.tsx` end-photo flow 傳 `walkMinutes` 給 `PhotoPromptSheet` 那行；或 `PhotoPromptSheet` 內 clamp
- **優先級提示**：P3（真實使用者不會走 0.4 分鐘）
- **PM 排序（2026-05-29）**：保留 P3。下個 UI/UX session 順手一行；iOS P0 freeze 期間不動 `src/`，不插隊。

---

## 已分類 — Feature Builder 接

_目前沒有 active 條目。已 SHIPPED 的見「已處理（audit trail）」。_

---

## 已分類 — Backend 接

_目前沒有 active 條目。已升級到 spec / 已 SHIPPED 的見「已處理（audit trail）」與各自 `docs/features/*.md`。dormant code 備註見 Deferred。_

---

## 新功能想法（待 PM 升 spec）

### 家庭邀請連結「進階版」（preview page + QR display）
- **發現於**：2026-05-25、Feature Builder session（minimal slice 已 ship，留 paper trail）
- **類型**：新功能想法（v1.5 polish）
- **已 ship 的 minimal slice**：`/join/{6位 inviteCode}` deep-link → 自動 `joinFamilyByCode` → 成功 redirect `/app`；沿用既有 already-member / not-found 訊息；Share UX（`navigator.share` + clipboard fallback button in family-section）；零新 schema、完全 additive。
- **沒做（PM 之後決定的 ambiguous 點）**：
  - **Preview page**：點 link 顯示「{family.name} 邀請你加入，有 N 人 + N 隻寵物」preview，確認才 join？需新 callable 給 unauthenticated preview（rules 限 member 才能讀 family doc）
  - **Link 過期**：schema 預留 `inviteCodeExpiresAt` 但未實作；regenerate 是否連動失效？
  - **濫用防範**：連結摩擦比手動 6 位數低，是否要 owner approval？
  - **QR code 顯示**：display QR（低工作量；與既有 Deferred「內建 QR scanner」是相反方向）
  - **多家庭 currentFamilyId 切換**：join 後是否自動設 active？
- **建議交付給**：PM（升 spec 後再 Feature Builder）
- **優先級提示**：P3（minimal slice 已可用）
- **PM 排序（2026-05-29）**：在 user 實測 minimal slice 反映摩擦後，挑 1-2 個 polish 合一個 spec（preview page + QR display 最自然）。iOS feature-parity 期間優先級低於 iOS P0。

---

## Deferred / 不做

> PM 決定不做（或暫不做）的條目搬來這裡 + 寫理由。比刪掉好，下次有人想重提時直接擋下。

### 內建 QR scanner
- **理由**：iPhone / Android 原生相機都能掃 QR 並開 URL，App 內建 scanner 增加 camera permission 摩擦 + bundle size，CP 值低。

### Settings 加直接到 `/onboarding` 的 link
- **發現於**：2026-05-23、Feature Builder（#2 spec B2 deviation）
- **理由（2026-05-29 PM 定案 Defer）**：`/onboarding` 是首次體驗頁，使用者後續幾乎不會回看；既有 family-section「加入」「新建」buttons 已滿足實際入口需求。低價值，歸 Deferred。若 user 明確要再重提。

### `mergeAndImportToFamily` callable + 共用 helper（永久 dormant — 不要順手刪）
- **發現於**：2026-05-23、PM session（user 拿掉 merge 決定後）
- **類型**：dormant code（不是待清理）
- **內容**：B4 ship + rollback 後 `functions/src/index.ts` 仍留 `mergeAndImportToFamily` callable（無 client caller）+ 內部搬子集合 / reassign petId / 刪 personal pet doc 的共用 helper。
- **PM 定案**：**永久 dormant**。原規劃併入 #4 dedupe session 處理，但 #4 已被 user 取消（見 `docs/features/mango-dedupe-migration.md`）。Backend / iOS Backend session 動 `functions/src/index.ts` 看到這段**不要順手刪**（保留供未來如真需要 dedupe 時 reactivate）。

---

## 已處理（audit trail）

> SHIPPED / RESOLVED / 已升級到 spec 的條目壓縮成一行收這裡。完整 ship 紀錄在 `docs/roadmap.md` 與各自 commit message。供日後追溯，不需再排序。

- **`ExpensesOverviewSection` dead code（從未被任何頁 import）** — ✅ 已刪除 `22bee39`（2026-05-26 Bug Hunter 修「拍收據不見了」時 grep 確認為 dead code；長期正解由 expenses-into-pets-page ship）。
- **walks-auto-photo-share spec「Privacy 預設 family-only」與實際 composer default `public` 不符** — ✅ 2026-05-29 PWA PM 已修 `docs/features/walks-auto-photo-share.md`（composer default 'public' 是 ui-polish-bundle 的 intentional behavior，非 epic regression）。
- **PWA 內 push token 不同 context 失效（要先停用再啟用 workaround）** — ✅ SHIPPED `9f1dc67`：新 `reconcileCurrentToken(uid)` in `src/lib/firebase/messaging.ts` 主動 `getToken` arrayUnion 進 `user.fcmTokens`（idempotent）；`push-toggle.tsx` 在 `perm === "granted"` 時呼叫 reconcile。
- **Personal walks 不應進全 App leaderboard** — ✅ 已升級到 `docs/features/family-leaderboard.md` Phase 0 prerequisite，隨 family-leaderboard epic SHIPPED。
- **未登入首頁 footer 連結文字硬編碼中文沒走 i18n** — ✅ SHIPPED `634e8c6`：加 `Common.privacy` / `Common.terms`（zh-TW + en），`src/app/page.tsx` 改用 `getTranslations("Common")`。
- **好友搜尋無法 case-insensitive** — ✅ 已升級到 `docs/features/friends-search-lowercase.md` 並 SHIPPED（中段 match 需 Algolia/Typesense，仍不在範圍，留觀察）。
- **Default landing 改為 `/app/walks`** — ✅ SHIPPED `5856e18`（UI/UX 2026-05-24）：`page.tsx getNextPath` default + `sign-in-buttons.tsx` + `onboarding/page.tsx` 3 處 + `manifest.json start_url`；`/app` 直接訪問不 redirect、nav home icon 仍 `/app`。
- **walks 頁加 sticky bottom CTA（解 A）** — ✅ SHIPPED `5c1429e`（UI/UX 2026-05-24）：`app/app/walks/page.tsx` 加 `fixed ... md:hidden` sticky bar 重用 Hero handler，tracking view 開啟時 unmount。
- **Mobile bottom nav 重組（開銷→排行榜、更多→設定右上角）** — ✅ SHIPPED `e34640a`（UI/UX 2026-05-23）：drawer state 提升到 `NavDrawerProvider`，trigger 移到 settings header；mobile 5 links `[home, pets, walks, leaderboard, settings]`，overflow 5 items 進 drawer。
- **[範例] 重複的 Mango pet** — 教學範例。已升級到 `docs/features/mango-dedupe-migration.md`（後被 user 取消，見該 spec）。保留當格式範例。
