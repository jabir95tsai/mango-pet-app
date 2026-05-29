# iOS Feature Parity Checklist — Web/PWA → React Native

狀態：**LIVE TRACKING**（Cross-platform PM 維護）
建立日期：2026-05-29
規格作者：Cross-platform PM session
配合：[`ios-app-strategy.md`](./ios-app-strategy.md)（戰略 + 8 phase plan）、[`ios-p0-monorepo-migration.md`](./ios-p0-monorepo-migration.md)（P0 細化）、[`../roadmap.md`](../roadmap.md)

> 這是 Web/PWA 與 iOS 的 **single source of truth for feature parity**。
> 每個 web 已 shipped 的 feature → 對應 iOS phase → iOS port 狀態 → platform policy。
> iOS Feature Builder / iOS PM 每完成一個 phase 回來更新 iOS 狀態欄。

## 怎麼用

- **Cross-platform PM**：維護這份表;新 web feature ship 後在此登記 + 指派 policy + phase。
- **iOS PM**：排 phase 時對照此表確認沒漏;phase 收尾更新狀態。
- **iOS Feature Builder**：做 parity feature 前先看本表確認該 feature 的 policy 與對應 web spec。
- **狀態值**：⬜ 未開始 / 🟡 進行中 / ✅ iOS 已達標(對齊 web behavior) / ⏸️ 本輪不做(見 policy) / ➖ 不適用 iOS。

## Platform policy 定義

| Policy | 意思 |
|---|---|
| **parity** | iOS 必須對齊 web behavior;在指定 P-phase 內做完。 |
| **parity + native upgrade** | 功能對齊 web,但 iOS 用 native 能力做得更好(可接受的「往上」差異,非 drift)。 |
| **deferred-v1** | web 有、但**第一版 iOS 不做**;ship 後另開 catch-up sprint。需 user 確認(見下方 Open Questions)。 |
| **web-only** | 平台本質差異,iOS 不做或由 OS 原生取代。 |

## Baseline snapshot

- 戰略 spec 鎖定的對齊基準 = web commit `f5c1732`（**2026-05-26**）。
- **晚於 snapshot 的 web ship**(屬「PWA 並行 ship、iOS catch-up」範疇,phase plan 未納)：
  - 照片圖庫 `/app/photos`（`e76f97c`,2026-05-27）— 見下方表 + Open Q3。
- 之後 PWA 每新 ship 一個 feature,Cross-platform PM 在本表新增一列並標 policy。

---

## A. Phase plan 已涵蓋的 parity 項目

> 這些 feature 在 [`ios-app-strategy.md`](./ios-app-strategy.md) 的 P0–P7 已有對應。policy 預設 **parity**,標註處為 native upgrade。

### P0 — Foundation
| Web feature | Web spec / 來源 | iOS policy | iOS 狀態 |
|---|---|---|---|
| Auth(Google 登入) | `src/app/page.tsx` / sign-in | parity + **Apple Sign-In 必加**（Apple guideline 強制,native upgrade） | ⬜ |
| BottomNav 5-tab + 中央 raised disc | Epic 4 Phase 0.5 `e1a7b60` | parity | ⬜ |
| Mango palette design tokens | Epic 4 Phase 0 `7baff73` / globals.css | parity（抽 `packages/shared-tokens`） | ⬜ |

### P1 — Walks（核心）
| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| Walks 全頁(radial dial + week strip + 圈內走路狗) | [`walks-v2-rebuild.md`](./walks-v2-rebuild.md) `984be5b` | parity | ⬜ |
| GPS tracking + timer + stop | walk-core | parity + **背景 GPS native upgrade**（web PWA 做不到,見 Open Q4） | ⬜ |
| Done screen + confetti + 達標變體 | walks-v2 | parity | ⬜ |
| 手動 walk dialog | walk-core | parity | ⬜ |
| Per-pet 自訂散步目標 + pet picker | [`per-pet-walk-goal.md`](./per-pet-walk-goal.md) | parity | ⬜ |
| Walk 拍照 + Storage 上傳 | walks-v2 | parity | ⬜ |
| 遛狗自動拍照 + 自動發動態(start/end prompt) | [`walks-auto-photo-share.md`](./walks-auto-photo-share.md) | parity | ⬜ |
| Walks history(recent) | walk-core | parity | ⬜ |

### P2 — Pets
| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| Pets 全頁(list + switcher + header 真照片) | [`pets-v2-rebuild.md`](./pets-v2-rebuild.md) | parity | ⬜ |
| 4-tab(概覽/提醒/開銷/健康) | pets-v2 | parity | ⬜ |
| 開銷 donut + filter + list + FAB camera | [`expenses-into-pets-page.md`](./expenses-into-pets-page.md) | parity | ⬜ |
| 健康(體重 trend chart + records) | pets-v2 | parity | ⬜ |
| 提醒(list + form) | pets-v2 | parity | ⬜ |
| AI 收據掃描(camera → extractReceipt callable) | bug-receipt-ai-missing / receipt-scanner | parity（接同 callable） | ⬜ |
| Pet edit form(含 walkGoal stepper) | per-pet-walk-goal | parity | ⬜ |
| EmptyState 0 pets | pets-v2 | parity | ⬜ |

### P3 — Home + Feed
| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| Home v3(Feed-first + IG Stories bar) | [`home-v3-feed-first.md`](./home-v3-feed-first.md) | parity | ⬜ |
| StoriesBar(walk status rings) | home-v3 | parity | ⬜ |
| PostCard list + PostComposer | home-v3 / feed | parity | ⬜ |
| InviteFamilyCard / EmptyStateHome | home-v3 | parity | ⬜ |
| `/app/feed` full timeline | feed | parity | ⬜ |
| PhotoLightbox(carousel + swipe) | [`photo-lightbox.md`](./photo-lightbox.md) | parity | ⬜ |
| 拍照後存到相簿 | [`save-photo-to-album.md`](./save-photo-to-album.md) | **parity + native upgrade**（web Share sheet → iOS PhotosKit） | ⬜ |

### P4 — Leaderboard + Family
| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| Leaderboard(family-aware + 即時 glow) | [`family-leaderboard-realtime.md`](./family-leaderboard-realtime.md) | parity | ⬜ |
| Family section(member + invite + leave) | family epic | parity | ⬜ |
| Family invite QR + share link(`/join/{code}`) | family epic / backlog 進階版 | parity | ⬜ |
| 加入家庭自動加好友 | [`auto-friend-family-members.md`](./auto-friend-family-members.md) | parity（trigger 已 ship,iOS 只呈現） | ⬜ |

### P5 — Push + Settings
| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| 4 種 engagement push(A1/A2/B1/B2) | [`engagement-push-notifications.md`](./engagement-push-notifications.md) | **parity + native upgrade**（web FCM 在 iOS PWA 殘缺 → APNs native） | ⬜ |
| Push toggle + 各 push opt-out | engagement-push | parity | ⬜ |
| WalkAutoPhotoSection toggle | walks-auto-photo-share | parity | ⬜ |
| DeleteAccount flow | settings | parity | ⬜ |
| DataExport | settings | parity | ⬜ |
| UI Polish bundle(friends icon / post default public / leaderboard refresh) | [`ui-polish-bundle-2026-05-25.md`](./ui-polish-bundle-2026-05-25.md) | parity（P7 統一 catch up 亦可） | ⬜ |

### P6 — Social
| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| Friends list + search(`/app/friends`) | friends-search-lowercase | parity | ⬜ |
| Friend request send/accept(`/app/friends/add`) | family/friends epic | parity | ⬜ |
| My QR dialog | friends epic | parity | ⬜ |

### P7 — Polish + Submit
| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| App icon / splash / screenshots / metadata | strategy P7 | ➖（iOS-only 上架物) | ⬜ |
| 隱私 / 服務條款 | `/privacy` `/terms` | parity（App Store 必須有,內容可重用 web） | ⬜ |

---

## B. ⚠️ Web feature **未被任何 iOS phase 涵蓋**（parity gap）

> 這些是實際存在的 web 路由 / feature,但 [`ios-app-strategy.md`](./ios-app-strategy.md) P0–P7 **完全沒提**。D4「feature parity 一次到位」與此矛盾。
> **以下 policy 是 Cross-platform PM 的「建議預設」,標 ⚠️ 待 user 拍板**(見 Open Questions),我不替 user 偷定義。

| Web feature | Web 路由 | 建議 policy | 理由 |
|---|---|---|---|
| **餐廳** | `/app/restaurants` + `/app/restaurants/[id]` | ⏸️ **deferred-v1**（建議） | 戰略 spec 零提及;roadmap 把「餐廳 Google Places 整合」列為未來「新方向候選」,代表此 feature 本身仍未深化。第一版 iOS 不做、ship 後 catch-up。 |
| **知識庫** | `/app/knowledge` + `/app/knowledge/[id]` | ⏸️ **deferred-v1**（建議） | 同上;roadmap「知識庫持續產出」仍是候選方向,內容導向、非核心遛狗 loop。 |
| **照片圖庫** | `/app/photos` | parity,**排進 P3**（建議） | 晚於 baseline ship(`e76f97c` 2026-05-27);與 feed/lightbox 同源,自然併入 P3 Home+Feed。iOS 用 PhotosKit 取代 web download(native upgrade)。 |
| **Onboarding 畫面** | `/onboarding` | parity-lite,**併 P0 auth flow** | 第一次登入導引;iOS 至少要有等價首登流程,內容可精簡。 |

---

## C. 平台合理差異(不是 drift,不要當 bug 修)

> 這些地方 iOS **本來就該跟 web 不一樣**,Cross-platform PM 預先認定為 acceptable。

| 面向 | Web/PWA | iOS | 認定 |
|---|---|---|---|
| Push 通道 | FCM web push(iOS PWA 支援殘缺) | APNs native | iOS 更好,acceptable |
| 存照片到相簿 | `navigator.share` / Blob download | PhotosKit 直接存 | iOS 更好,acceptable |
| 登入方式 | Google | Google **+ Apple Sign-In** | Apple guideline 強制,acceptable |
| 遛狗背景定位 | 不做(roadmap 明列「不做 Web 內背景 GPS」) | CoreLocation 可背景追蹤 | **見 Open Q4** — 要不要解禁成 iOS-only 能力 |
| HEIC / Live Photos | 不適用 | 接受 native limitation,不特別支援 | risk table 已認 |
| 路由 | Next.js App Router(URL) | Expo Router(native stack/tab) | 實作差異,UX 對齊即可 |

---

## D. Open Questions（需 user 拍板,Cross-platform PM 不偷定義）

- **Open Q1 — 餐廳是否進第一版 iOS?**
  建議 **deferred-v1**(ship 後 catch-up)。若 user 認為餐廳是核心體驗一部分,則要插進某個 phase(預估 +1 週)。
- **Open Q2 — 知識庫是否進第一版 iOS?**
  建議 **deferred-v1**。同餐廳。內容型 feature,對「遛狗為核心」的第一版優先級低。
- **Open Q3 — 照片圖庫(`/app/photos`)排哪?**
  建議併 **P3**。確認後我更新 strategy phase plan 的 P3 清單(交 iOS PM 改 spec,我只記 policy)。
- **Open Q4 — iOS 遛狗要不要做背景 GPS?**
  web 明確「不做背景 GPS」。iOS native 做得到。但 D4 是 *parity*(對齊),不是 *expansion*(擴張)。
  - 選項 A:第一版只做前景追蹤(嚴格 parity,最快 ship)。
  - 選項 B:第一版就做背景追蹤(iOS 殺手級差異,但增加 P1 工作量 + App Store 背景定位審查風險)。
  建議 **A**(先 ship parity,背景 GPS 留 iOS-only follow-up)。
- **Open Q5 — D4「parity 一次到位」是否正式收斂為「核心 parity 一次到位 + 餐廳/知識庫 catch-up」?**
  若 Q1+Q2 都 deferred,則第一版 iOS 嚴格說不是 100% parity。建議把 D4 措辭調成「**核心 feature parity 一次到位**(walks/pets/home/feed/leaderboard/family/social/push),餐廳+知識庫列 post-launch catch-up」。我可代為更新 strategy doc 的 D4 註記。

---

## E. Handoff

- **iOS PM**：看 §B + §D。Q3 確認後把照片圖庫補進 strategy P3;Q1/Q2 確認後在 strategy 標 deferred-v1 清單。
- **iOS Feature Builder**：做任一 feature 前回查本表該列 policy + web spec 連結;native upgrade 項(push/save-photo/auth)依 §C 實作,不算 deviation。
- **Web 側**：PWA 每新 ship feature → 通知 Cross-platform PM 在 §A/§B 新增列(避免 iOS 漏 catch-up)。

## 維護紀錄

- 2026-05-29 建立(Cross-platform PM):盤點 web 全 20 路由 → 對齊 P0–P7;抓出餐廳/知識庫/照片圖庫 3 個 phase plan gap;列 5 個 open questions。
