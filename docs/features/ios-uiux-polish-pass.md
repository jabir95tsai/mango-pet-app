# iOS UI/UX Polish Pass — 全 app 視覺/原生手感

狀態：**READY-FOR-DEV**（iOS PM 2026-06-01）
建立日期：2026-06-01
規格作者：iOS PM session
角色執行：**iOS UI/UX 工程師**（純視覺/互動，不碰資料層）
上承：P0–P7 feature 全 code-done（功能對、外觀粗胚）→ 本 pass 把整個 app 視覺拉到 mango 設計 + iOS 原生手感
配合：[`ios-port-master-plan.md`](./ios-port-master-plan.md)、[`ios-parity-checklist.md`](./ios-parity-checklist.md)、各 phase ship note

> user 2026-06-01：「整個目前看起來 ok，接著做 ui/ux 部分。」P2–P7 功能已建（pets/feed/leaderboard/family/settings/friends/onboarding），現在做**視覺 polish pass**。

## 🎯 目標

把「功能對、外觀粗胚」的 iOS app，整面拉到：**mango brand（amber/黃 + emerald + 桃粉，圓角 2xl + rounded-full）+ iOS 原生密度/手感 + safe-area + a11y + reduced-motion**。對齊 web 視覺方向，但**不是像素複製**（戰略 D1 = 原生手感）。

## ✅ 前提（好消息：無新 dep gate）

動畫/繪圖 dep **全部已裝**（P2/P3 引入並過 gate）：`react-native-svg` / `react-native-reanimated` / `react-native-gesture-handler` / `expo-linear-gradient`。
→ **本 pass 預設不加新 dep → 不需 web rollout gate**（純 apps/ios style/animation）。若某項真要新 dep（少見）→ 停手回報 iOS PM 走 branch+gate。
→ 驗收依 **規則 5 批次**：一路 polish merge（每步 tsc），**末端一次 EAS build 實機驗整個 app**。

## 🚫 不做（已完成 / 別重做）
- **confetti 引擎**：已升級（canvas confetti `b92e966` + `confetti-engine-upgrade` spec）→ 不重做，只確認其他 surface 引用一致。
- **achievements/解鎖慶祝**：已有 spec（`achievements-badges`）→ 不在本 pass。
- **onboarding/privacy**：P7 已做（`1972d6c`）→ 只做視覺 polish，不改 flow。
- 資料層 / Firestore / functions / callable 簽名 → 完全不碰。

---

## 🧱 UX-0 — 跨切面 primitives + token 細修（先做，後面全 surface 共用）

> 先建可重用 native primitives + 對齊 token，後面每個 surface polish 都複用，避免各畫面各刻一套。

- **mango tokens 細修**（`@mango/shared-tokens` → iOS `theme.ts`）：確認 amber/emerald/桃粉、文字階層、radius（2xl / full）、spacing、shadow/elevation 對齊 web `globals.css` @theme。
- **Reusable primitives**（`apps/ios/src/components/ui/`）：`Button`（primary/secondary/ghost + pressed state + 觸覺 `expo-haptics`?僅若已裝，否則略）、`Card`、`Screen`（safe-area + scroll + keyboard avoidance wrapper）、`Sheet`（Expo Router modal 包裝）、`Pill`/`Chip`、`EmptyState`、`Avatar`。
- **safe-area 策略**：`react-native-safe-area-context`（已裝）統一 top/bottom inset；full-screen modal（tracking / lightbox）避瀏海 + home indicator。
- **reduced-motion helper**：`AccessibilityInfo.isReduceMotionEnabled` 包成一個 hook，所有動畫（dial/走路狗/glow/confetti/sheet transition）統一吃它。
- **a11y 基線**：tap target ≥ 44pt、accessibilityLabel/Role、focus 順序、對比 WCAG AA。

---

## 🎨 Per-surface polish（UX-0 後，依「最常看到 + 最粗」排序）

> 每個 surface：對照 web 視覺 → iOS after。用 UX-0 primitives。

### S1 — Walks（核心，user 已看過最粗）
- **dial**：分段環 → **平滑 arc**（`react-native-svg` circle stroke-dashoffset），達標 leaf 綠漸層。
- **走路狗**：靜態 → **Reanimated 走路動畫**（對齊 web 6-keyframe 精神：bob/腿擺/尾搖），reduced-motion 時靜態。
- **week strip / streak chip**：完成日 paw fill、today 高亮、streak ≥7 leaf 變體 + flame flicker（reduced-motion skip）。
- **tracking full-screen**：safe-area、timer/距離視覺層級、紅停止鈕 affordance。
- **done screen**：emerald 慶祝 wash + 達標標題 + streak badge pop（confetti 引擎已做，確認串接）。

### S2 — Home + Feed
- **Stories bar**：pet walk status conic ring（done/pending/tracking）— svg/reanimated；user dashed ring。
- **PostCard**：author 區、photo grid(1/2/2+) 間距/圓角、reaction/comment badge、visibility icon。
- **Reactions long-press tray** + **PhotoLightbox**：gesture-handler 手勢順滑（水平切換/下滑關閉）、reduced-motion。
- **Composer / sheets**：keyboard avoidance、photo grid、發佈 affordance。
- **empty/no-posts/invite cards**：linear-gradient + CTA 視覺。

### S3 — Pets
- **header**（avatar + chips）、**4-tab pill** 切換動效/active 視覺、**StatGrid**。
- **開銷 donut + legend**、**健康 weight chart**：色彩/標籤/座標視覺細修（功能已對，純美化）。
- **forms（reminder/expense/health/pet-edit）**：sheet 呈現、欄位密度、datepicker 樣式、stepper。
- **0-pet EmptyState** gradient hero。

### S4 — Leaderboard + Family
- **rank list**：名次視覺、自己高亮、**glow 更新動效**（reduced-motion skip）、human/dog/period tab 切換。
- **family section**：member list、invite QR 卡、code/share 視覺。

### S5 — Settings + Friends
- **settings**：section 分組、toggle 原生樣式、photos preview grid、delete/export 危險動作視覺。
- **friends**：list、search、request accept/reject、My QR dialog。

### S6 — 全 app 收斂 QA
- 一致性 audit（間距/圓角/色票/字級跨 surface 一致）、loading/error/empty tone、reduced-motion 全 surface、Dynamic Type 不破版、bottom nav raised disc 與各頁互動。

---

## 🤝 角色 / 護欄
- **iOS UI/UX 工程師**主導；只動 `apps/ios/**` UI + `shared-tokens` + `shared-i18n` 文案微調。
- **不碰**：Firestore/Storage/functions/callable 簽名、shared-firebase API、web UI、feature flow（功能缺口 → iOS Feature Builder）。
- 預設不加 dep；真要加 → 停手回報 iOS PM 走 gate。

## ✅ 驗收（規則 5 批次）
- 一路 polish，每步 `npx tsc --noEmit`（apps/ios）+ merge，**中途不發 device build**。
- 全 surface polish 收齊 → iOS PM 發**一顆** EAS build → user 一次走完整 app 看視覺（before/after 對照 web）。
- a11y / reduced-motion / safe-area / tap target 抽查。

## 🚀 Launch prompt（開 iOS UI/UX session）

> 範圍大 → 可一個 session 做 UX-0 + S1–S2（最常看到的），再開第二個 session 做 S3–S6;或一個 session 慢慢全做。驗收一樣 batched 末端一次。

```
平台：iOS｜角色：iOS UI/UX 工程師
先讀：AGENTS.md、docs/team/README.md（規則 5 批次驗收）、docs/team/ios-ui-ux.md、docs/features/ios-uiux-polish-pass.md（本 spec）、docs/features/visual-redesign-mango.md（web 視覺方向參考）
先跑：git fetch && git log -8 --stat origin/main

任務：iOS 全 app UI/UX polish pass（功能已 code-done，做視覺/原生手感）。
順序：先 UX-0（primitives + token + safe-area + reduced-motion hook + a11y 基線）→ 再 S1 Walks → S2 Home/Feed →（同 session 或下一棒）S3 Pets → S4 Leaderboard/Family → S5 Settings/Friends → S6 收斂 QA。
細節照 ios-uiux-polish-pass.md 各 surface 清單。

護欄：
- 只動 apps/ios/** UI + shared-tokens + shared-i18n 文案微調
- 不碰 Firestore/Storage/functions/callable/shared-firebase API/web UI/feature flow
- 動畫 dep（svg/reanimated/gesture-handler/linear-gradient）已裝 → **不要加新 dep**；真要加停手回報 iOS PM
- 動畫一律吃 reduced-motion hook；safe-area 用 safe-area-context；tap target ≥44pt
- confetti 引擎/achievements/onboarding flow 已做 → 不重做（只確認視覺串接）

驗收（規則 5 批次）：
- 每步 npx tsc --noEmit（apps/ios）pass + merge；**中途不發 device build、不要 user 中途驗**
- 全 surface 收齊 → 通知 iOS PM 發一顆 EAS build，user 一次走完整 app 看 before/after

回報：
1. 角色 + 做了哪些 surface（commit hash）
2. before/after 或 web reference 對照（截圖或描述）
3. 有沒有加 dep（應為無）/ 有沒有發現功能 bug（丟 iOS Bug Hunter，不自己修 flow）
4. 給 iOS PM：哪些 surface polish 完、parity §A 對應列可標視覺 ✅、剩哪些 surface 待下一棒
```

## 跟其他 spec 的關聯
- 視覺方向參考 web [`visual-redesign-mango.md`](./visual-redesign-mango.md)（mango palette + Epic 4 決策）。
- confetti/celebration：`confetti-engine-upgrade` / `walks-photo-and-celebration` / `achievements-badges` 已涵蓋，本 pass 不重做。
- 功能 spec：各 phase（walks/pets/feed/leaderboard/settings/friends）為 behavior reference，本 pass 不改 behavior。

---

## 📦 Session 1 SHIPPED — UX-0 + S1 + S2（iOS UI/UX 工程師，2026-06-03）

範圍照 spec line 91 建議：一個 session 做 **UX-0 + S1–S2（最常看到的）**，S3–S6 留下一棒。全程 `tsc --noEmit` 綠 + push main（**無 device build、未實機驗** — 依規則 5 末端一次 EAS）。**無新 dep**。

### Commits（都在 main）
| Surface | Commit | 內容 |
|---|---|---|
| UX-0 | `175345f` | `theme.ts` 加 shadow tiers（card/elevated/mango，暖棕底）+ typography scale（`type.*`），既有 colors/spacing/radius 不動。`useReducedMotion` hook（單一來源 + live 訂閱，收斂 4 處 ad-hoc `AccessibilityInfo`）。`components/ui/` primitives：`Button`（primary/secondary/ghost/danger、≥44pt、ink-on-brand AA、pressed scale）/`Card`/`Screen`（safe-area+scroll+kbd）/`Sheet`/`Pill`/`EmptyState`/`Avatar` + index barrel。`PetAvatar`/`UserAvatar` 改成 `Avatar` 薄殼。 |
| S1 Walks | `6a373c4` | `walks-dial`：60-tick segmented ring → 單一 animated SVG arc（strokeDashoffset），brand→amber 漸層、達標轉 leaf→success 綠；中央 🐕 改 Reanimated 走路 bob+tilt（reduced-motion 靜態）。`walks-week-strip`：完成日 paw fill。`walks-streak-chip`（新）：≥7 天 leaf milestone + flame flicker（reduced-motion 靜態，flame a11y-hidden）。walks 畫面：0-pet → `EmptyState`、sticky CTA → `Button`（ink-on-brand 修掉先前白字 on 橘的 AA miss）。done-screen emerald 慶祝 + confetti 串接**已驗證不變**。 |
| S2 Home/Feed | `a194097` | `pet-story-avatar`：flat 漸層 disc → 乾淨 SVG stroked status ring（done/tracking/pending），對齊 dial/donut SVG 慣例 + web conic。`post-card`：card radius 2xl + 暖 resting shadow、leaf tag 文字 → `#3f7a39`（修 leaf-on-leafTint AA）、留言 badge 36→44pt。`invite-family-card` CTA 36→44pt + ink-on-brand。`post-composer`：包 `KeyboardAvoidingView`。 |

### a11y 修掉的 contrast/tap 問題（順手）
- 白字 on 橘底（fail AA 2.6:1）→ ink-on-brand：walks sticky CTA、invite-family CTA。
- leaf on leafTint（2.6:1）→ `#3f7a39`：post-card 寵物 tag。（同 web Phase 1 deviation 1 的精神，建議之後加 `mango.leafDeep` token 收斂。）
- tap target < 44pt → ≥44pt：post-card 留言 badge、invite-family CTA。

### 給 iOS PM
- **parity §A 可標「視覺 ✅」對應列**：Walks（S1 全項）、Home/Feed（stories ring / PostCard / composer kbd）。Lightbox/reactions/confetti 視覺串接確認過、未改 flow。
- **剩餘 surface（下一棒 iOS UI/UX session）**：**S3 Pets**（header/4-tab/donut/weight chart/forms/empty）、**S4 Leaderboard/Family**（rank glow/QR）、**S5 Settings/Friends**、**S6 全 app 收斂 QA**。下一棒直接複用 UX-0 primitives（`@/components/ui`）+ `useReducedMotion`。
- **無發現功能 bug**（純視覺層，未碰 flow/資料層）。若末端 EAS 走查發現 runtime bug → iOS Bug Hunter。
- **驗收**：S3–S6 收齊後，PM 發**一顆** EAS build，user 一次走 before/after。

---

## 📦 Session 2 SHIPPED — S3 + S4 + S5 + S6（iOS UI/UX 工程師，2026-06-03）

一個 session 一路做完 **S3→S4→S5→S6**，全程複用 Session 1 的 `@/components/ui` primitives + `useReducedMotion`（**沒有重刻**）。每步 `tsc --noEmit` 綠 + push main（**無 device build、未實機驗** — 規則 5 末端一次 EAS）。**無新 dep**。

### Commits（都在 main）
| Surface | Commit | 內容 |
|---|---|---|
| S3 Pets | `faeb50c` | `pet-tabs`：per-tab 背景切換 → 單一滑動白卡 indicator（Reanimated translateX 220ms，reduced-motion 直接定位），tab ≥44pt。`weight-chart`：漸層面積填色 + 上/底 faint gridline + min/max kg y-hint + 首/末日期 x 軸標籤（圖表算法不動）。`pets-empty-state`：bespoke 漸層 → `EmptyState` primitive（gradientHero）。 |
| S4 Leaderboard+Family | `2ce2e9f` | `segmented`：per-seg 切換 → 單一滑動 indicator（Reanimated，reduced-motion snap），leaderboard dimension/scope/period 共用，active ≥44pt。`leaderboard-row`：glow 改 opacity-fade overlay（不再 animate bg），「我」row 可同時帶 cardSoft 底 + brand 邊（glow 仍吃 `useReducedMotion`）。human/dog 空狀態 CTA → `Button`。`family`：primary 按鈕 ink-on-brand、code 複製/分享/QR 38→44pt、My-QR dialog 改置中。 |
| S5 Settings+Friends | `e69925b` | `settings`：flat card stack → iOS 分組 section（一般/通知/遛狗與隱私/資料與帳號 uppercase header），登出 36→44pt；native Switch+radio 既有原生樣式保留。`friends`：accept/加好友/QR-close ink-on-brand、tab 38→44pt、accept/reject/QR-action →44pt；My-QR dialog 已置中。`friends/add` 送出鈕 ink-on-brand。export/delete 危險動作（outline danger + white-on-cookie 4.2:1 + ink export）查核 OK 不動。 |
| S6 收斂 QA | `2aa5988` | 跨 surface audit → 收掉**最後 9 個** white-on-brand 文字鈕（2.6:1 fail AA）統一 ink-on-brand：comment send / post publish / manual-walk save / walk-tracking save / camera 用此張 / receipt 手動輸入 / form-sheet SelectField active pill / join-family CTA / onboarding primary。 |

### S6 一致性 audit 結論
- **reduced-motion**：全 app 8 個有動畫的 component 全部吃 `useReducedMotion`（dial/走路狗/streak flame/story ring/pet-tabs/segmented/leaderboard glow/confetti/lightbox），**0 個殘留 ad-hoc `AccessibilityInfo`**。
- **對比 AA**：所有 brand 底主要按鈕文字 = ink-on-brand（5.2:1）。white-on-dark（相機/lightbox 黑底）、white-on-cookie/red（destructive，≥4.2:1 或慣例）保留。
- **tap target**：本 session 所有互動元件補到 ≥44pt（tabs/segmented/code 動作/friends 動作/登出）。
- **token 一致**：圓角/色票/字級走 `theme` token；新卡片向 PostCard 的 radius 2xl + `shadows.card` 對齊。
- **已知保留**（非 bug，記錄供 PM 判斷）：FAB「＋」與 your-story「＋」glyph 仍 white-on-brand（大型裝飾性 icon，沿用 Material/IG FAB 慣例；如要 100% ink 化再開一張小票）。

### 給 iOS PM — ✅ 全 surface 視覺 polish 完成
- **iOS 全 app（UX-0 + S1–S6）視覺 polish 已收齊**，請發**末端一顆 EAS build**，user 一次走完整 app before/after。
- **parity §A 可標「視覺 ✅」**：Pets / Leaderboard / Family / Settings / Friends（＋ Session 1 的 Walks / Home-Feed）。
- **無新 dep**（svg/reanimated/gesture-handler/linear-gradient 已裝）。
- **無發現功能 bug**（純視覺/互動層，未碰 flow/資料層/callable）。末端 EAS 走查若遇 runtime bug → iOS Bug Hunter。
