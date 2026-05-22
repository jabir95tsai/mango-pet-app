# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-22

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- _目前沒有正式進行中項目 — Phase 1+2+3+4 家庭功能已完成，QR 加好友也已上線。等下個 PM session 排序。_

## 下一個（已規格化，可直接交付）

> 有 spec、有完成標準。Feature Builder 可以接手實作。

- _等 PM 寫第一個_

## 想做但還沒規格

> 想法階段。PM 還沒下決定要不要做、做的話怎麼做。

- 家庭 leaderboard：在排行榜頁面切換「全 App」/「家庭內」
- 開銷 payer 分析卡：哪個家庭成員花了多少（`aggregateByPayer` helper 已就緒）
- Reminder doneByUid 顯示：「上次由 OO 完成」標籤
- Legacy 路徑清理：family 完成 migration 後刪 `users/{uid}/pets|walks|reminders|expenses`
- 兩隻 Mango 去重的批次 migration

## 不做（拒絕清單）

> 比「做」更重要。寫下來防止反覆討論同一件事。

- _尚無_

## 北極星指標（每月看一次）

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率

> 還沒接 analytics — 目前只能定性觀察。
