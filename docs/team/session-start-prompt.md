# Session 啟動 prompt

能讀 repo 的 agent（Claude Code、Codex）會自動載入根目錄的 `AGENTS.md`，並自行判斷角色，所以一般情況直接描述任務就好。

需要固定角色，或想先把範圍講清楚時，貼這段：

```text
角色：docs/team/{{角色檔案}}（例：ios-pm.md）
任務：{{要做什麼}}
完成標準：{{怎樣算做完}}
不在範圍：{{可省略}}
```

如果 agent 讀不到 repo，要一併貼上 `AGENTS.md`、對應的角色檔和相關 spec 的內容。

角色檔對照表見 [README.md](./README.md#角色一覽)。
