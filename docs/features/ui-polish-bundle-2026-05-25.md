# UI Polish Bundle 2026-05-25（friends icon + post default + leaderboard refresh）

狀態：**SHIPPED 2026-05-25**（4 commits `76ac18d` → `9ab5c10`；3 個 UI item 全接，App Hosting 自動 build frontend）
建立日期：2026-05-25 下午
最後更新：2026-05-25 下午
規格作者：PM session @ `54c0781`
角色：**UI/UX**（整 stack — 3 個 UI 細修 + 1 個 default value 改 + 1 個 refresh listener wiring + i18n）
工作量：**S**（3 個 quick win 合 1 個 spec，1 個 session 內 ship）

## SHIPPED bookkeeping

| Commit | What |
|---|---|
| `76ac18d` | feat(settings): friends icon button in avatar box + remove old nav entry |
| `d53f65e` | feat(feed): post-composer visibility default 'public' |
| `74751a3` | feat(leaderboard): refresh button + 800ms spinner + listener re-subscribe |
| `9ab5c10` | chore(i18n): Settings.friendsLink + Leaderboard.refreshButton (zh-TW + en) |

### 後續驗證 / 觀察

- Settings page user-avatar 框右側 friends icon → 點進 /app/friends ⏳ live test
- Post composer 預設 'public' → 第一次發 post 預設可被公開看 ⏳ user 觀察是否符合預期
- Leaderboard refresh button → 800ms spinner 後 listener 重 subscribe ⏳ live test
- 既有 real-time listener (family-leaderboard-realtime SHIPPED) 仍 work ✅ 不破舊功能

## User Vision（原話保留）

> 「將好友移到設定的自己頭像的方框內右邊」
> 「分享時以公開為預設」
> 「排行榜加入刷新按鈕」

（第 4 個「加入家庭時自動加入家庭成員好友」獨立 spec [`auto-friend-family-members.md`](./auto-friend-family-members.md)）

## 3 個 decisions（confirmed，全採 PM 推薦）

| # | Item | Decision |
|---|---|---|
| **#1** ✅ | 好友入口移到 settings avatar 框 | **Icon button**（人頭圖示）→ `/app/friends`；放在 user avatar 框右側 |
| **#3** ✅ | 分享預設公開 scope | **Post composer 貼文預設 'public'**（不是家庭邀請連結）|
| **#4** ✅ | 排行榜刷新按鈕 | 加 icon button + spinner during refresh |

## 完成標準

### Item #1 — Friends icon button 移到 settings avatar 框

- [ ] 找到既有 Friends 入口位置（推測：drawer / nav menu / settings page 某處）
- [ ] `src/app/app/settings/page.tsx`（或對應 user avatar 框元件）：
  - User avatar 框右側加 icon button（24-28px）
  - Icon: Lucide `Users` (or 人頭圖示對齊現有 design language)
  - Color: `mango.brandDeep` on `mango.brandTint` round bg or 透明 hover
  - onClick → `router.push('/app/friends')`
  - aria-label「好友」/「Friends」
  - 44×44 hit area（mobile a11y）
- [ ] **移除** 既有 Friends 入口（避免重複；舊位置可能是 drawer item / nav link）
- [ ] 視覺對齊 mango palette + walks v2 / pets v2 風格

### Item #3 — Post composer 貼文預設 'public'

- [ ] `src/components/feed/post-composer.tsx`：
  - 找到 privacy / visibility 初始 state
  - 改 initial value 從目前（推測 'family' or 'friends'）改成 `'public'`
  - 若有 PrivacyEnum / type，確認 'public' 是 valid value
  - 若 composer 有「上次選擇」記憶機制，**不破壞** — 只改第一次 default
- [ ] UI 細節：composer 預設選項 visual cue 對 'public'（如 globe icon active）
- [ ] **不 migrate 既有 posts**（per-post privacy 已存）
- [ ] Privacy 切換功能完全保留（user 仍可手動改 family/friends-only）

### Item #4 — 排行榜刷新按鈕

- [ ] `src/app/app/leaderboard/page.tsx`（或 LeaderboardView 元件）：
  - Header 右側加 icon button（Lucide `RefreshCw`）
  - 44×44 hit area，brandDeep icon on transparent bg
  - onClick:
    - Set `isRefreshing = true`
    - Re-trigger Firestore query / re-subscribe onSnapshot
    - 顯示 spinner（icon rotate 1s）or replace icon with `Loader2` spinning
    - 800ms 後 reset `isRefreshing = false`（給 user 視覺 feedback even if data already up-to-date）
  - aria-label「刷新排行榜」/「Refresh leaderboard」
- [ ] **沿用既有 onSnapshot listener**（family-leaderboard-realtime SHIPPED 機制）— refresh button 只是 user-perceived control，real-time 仍自動跑
- [ ] disabled 狀態（refreshing 中）button 不再可點

### i18n

- [ ] `messages/zh-TW.json` + `messages/en.json` 新 keys：
  - `Settings.friendsLink`（「好友」/「Friends」— icon button aria-label）
  - `Leaderboard.refreshButton`（「刷新排行榜」/「Refresh leaderboard」— aria-label）
  - **不需** 新 key for post default public — privacy switch 本來就有 i18n

### 護欄

- [ ] 不動 friends backend logic / friendships schema
- [ ] 不動 leaderboard scoring / Firestore query 邏輯（只多 1 個 manual trigger）
- [ ] 不動 post privacy 切換功能（只改 initial default）
- [ ] 不動 既有 settings page 其他 sections
- [ ] 不動 mango tokens
- [ ] 不引入新 dependencies
- [ ] Privacy 改 'public' 預設後，**user education**：若有 onboarding tooltip 可考慮加（spec 不強制）

### 預驗收 checklist

- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP iPhone (`/app/settings`)：
  - User avatar 框右側出現 Users icon button
  - 點 → 跳轉 `/app/friends`
  - 既有 drawer / 其他位置的 Friends 入口已移除
- [ ] Chrome MCP iPhone (`/app/feed`)：
  - 開 post composer → privacy 預設 = 'public'（globe icon active）
  - 手動切 family-only → save → 該 post 仍 family-only（功能保留）
- [ ] Chrome MCP iPhone (`/app/leaderboard`)：
  - Header 看到 refresh icon button
  - 點 → icon rotate 800ms → data refreshed
  - 雙瀏覽器 test：A 點 refresh，B walk → A 看到 entries 更新（既有 real-time 仍 work）
- [ ] reduced-motion 用戶：refresh button spinner 縮短或停 rotate
- [ ] Lighthouse a11y 不掉
- [ ] commit message: `feat(ui): polish bundle — friends icon + post default public + leaderboard refresh`

## 不在範圍

- 「加入家庭時自動加入家庭成員好友」（獨立 spec `auto-friend-family-members.md`）
- 既有 posts 改 privacy（per-post 不 migrate）
- Pull-to-refresh on leaderboard（mobile gesture — future polish）
- Refresh button 在其他頁面（walks / feed / pets — 都用 real-time listener，無需）
- Friends icon 加未讀計數 badge（如果 friend request unread）— future
- Settings page 全頁重設計（Phase 4 Epic 4 visual redesign cover）

## Edge cases

| Case | 處理 |
|---|---|
| User 在 settings 點 friends icon 但無 friend | 進 /app/friends 看到 EmptyState（既有）|
| Post composer 0 photos + 預設 public | OK，純文字 post 也可 public |
| Leaderboard 0 entries 點 refresh | spinner 跑 800ms + 仍顯示 empty |
| Refresh button 連續快速點 | disabled state 防止重複觸發 |
| Privacy 從 public 改 family-only post 已發 | 既有編輯流程處理（本 spec 不動）|
| Drawer 移除 Friends item 後其他 user 找不到 | Settings avatar icon 是主入口；可加 /app/friends URL 直接訪問仍 work |

## 跟其他 spec 的關聯

- **family-leaderboard-realtime.md (SHIPPED)**：Item #4 沿用既有 onSnapshot listener；refresh button 是 user-perceived control
- **auto-friend-family-members.md**：本 spec Item #1 friends icon 提高 user 看到 friends 頁的曝光；自動加好友 ship 後 friends 頁會有更多人，icon 入口更有意義
- **pets-v2-rebuild.md**：無關聯
- **save-photo-to-album.md (SHIPPED)**：無關聯
- **per-pet-walk-goal.md (SHIPPED)**：無關聯
- **Epic 5 push specs**：無關聯
- **future Epic 4 Phase 4 settings 重設計**：本 spec friends icon 位置可能被 Phase 4 重排，但 icon-button pattern 應保留

## PM 觀察

工作量 **S** — 3 個小 UI 改，1 個 session 內 ship。建議 commit 拆解：

1. `feat(settings): friends icon button in avatar box + remove old entry`
2. `feat(feed): post-composer privacy default 'public'`
3. `feat(leaderboard): refresh button + spinner + 800ms feedback window`
4. `chore(i18n): Settings.friendsLink + Leaderboard.refreshButton (zh-TW + en)`

（或合 1 個 commit）

**Privacy 改 'public' 影響**：user 第一次發 post 預設可被公開看見。雖然 user 明確要求，FB session 可以考慮**加 onboarding tooltip**「分享給所有人」（一次性）— spec 不強制，FB 自選。

## UI/UX launch prompt

```
本 session 固定角色：UI/UX — 3 個 quick win UI 改。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/ui-polish-bundle-2026-05-25.md（PM 寫好，含 3 items + 完成標準 + 護欄）
- 既有 settings page: src/app/app/settings/page.tsx
- 既有 post composer: src/components/feed/post-composer.tsx
- 既有 leaderboard: src/app/app/leaderboard/page.tsx
- 既有 friends 入口位置：需 grep 找（可能在 drawer / nav menu / settings 某處）
- mango palette: src/app/globals.css 的 @theme inline
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4

護欄
- 動上述 4 個檔 + messages/*.json OK
- 不動 friends backend logic / friendships schema
- 不動 leaderboard scoring / Firestore query 結構
- 不動 post privacy 切換功能（只改 initial default）
- 不動 mango tokens
- 不引入新 dependencies

實作順序
1. Item #1 friends icon button — grep 既有 friends 入口、移除、加進 settings avatar 框右側
2. Item #3 post composer privacy default — 找到 init state、改 'public'
3. Item #4 leaderboard refresh button — 加 header icon button + 800ms feedback + re-trigger listener
4. i18n keys 補
5. npx tsc --noEmit pass
6. Chrome MCP 跑 3 個改動驗收
7. commit 1-4 個（自選合併）
8. push origin main

預驗收（spec 內 checklist 跑完）
- Settings avatar 框右側 friends icon 點 → /app/friends
- Post composer 預設 globe (public) active
- Leaderboard refresh button 點 → spinner 800ms
- 既有 real-time listener 仍 work
- npx tsc --noEmit pass
- Lighthouse a11y 不掉

回報格式
- 每 commit hash + 1 行 review note
- 全部 ship 後 summary 給 PM 收尾 roadmap

開工。
```
