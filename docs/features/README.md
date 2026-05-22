# Feature specs

每個檔案 = 一個功能規格，PM 寫好給 Feature Builder 接手。檔名用 kebab-case：
`docs/features/family-leaderboard.md`、`docs/features/expense-payer-breakdown.md` 等。

完成上線後可以保留當 changelog，或搬到 `docs/features/done/`。

## 模板

複製這段當新規格的起點：

```markdown
# [Feature 名稱]

狀態：DRAFT / READY-FOR-DEV / IN-PROGRESS / DONE
建立日期：YYYY-MM-DD
最後更新：YYYY-MM-DD
規格作者：PM session（commit hash）

## User Story

作為 [角色]，我想 [動作]，因為 [目的]。

## 為什麼是現在做

[時機 / 優先級理由 — 為何不是下個月做]

## 完成標準（這個功能上線時必須滿足）

- [ ] 使用者可以從 [入口] 進入
- [ ] 走完 [步驟 1] → [步驟 2] → [步驟 3]
- [ ] 資料正確存到 Firestore [path]
- [ ] 重新整理後資料還在
- [ ] i18n 兩個 locale 都齊（zh-TW + en）
- [ ] Edge case：[權限拒絕 / 離線 / 空資料] 都有處理

## 成功指標（上線後一週看）

- [可量化的數字，例如「3 天內有 5 個 X 被建立」]
- [質性回饋來源，例如「測試家庭沒有人卡關」]

## 不在這次範圍

- [明確排除什麼 — 防止 scope creep]

## 技術筆記（給 Feature Builder 參考）

- 接近的已實作功能：[現有 reference]
- 新 type / collection 預估：[簡短列舉]
- 新 security rule 需求：[要動哪些 path]
- 新 index 需求：[query 形狀]
- 對 Backend / Migration 的依賴：[有的話寫清楚]

## 開放問題

> Feature Builder 開工前要回 PM 確認的問題清空

- [ ] [問題 1]
```

## 檔案命名建議

- `family-leaderboard.md`
- `expense-payer-breakdown.md`
- `reminder-done-attribution.md`
- `legacy-data-cleanup.md`

避開縮寫、避開大寫、不要寫日期（git history 會記）。
