<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mango Pet agent bootstrap

This repo uses fixed-role sessions. Before starting non-trivial work, read:

1. `docs/team/session-start-prompt.md`
2. `docs/team/README.md`
3. the role file named by the user, such as `docs/team/cross-platform-pm.md`
4. **before ANY UI work** (web or iOS): `docs/design-system.md` — the brand/style single source of truth (whole-app mango palette, `--radius-*` scale, tabs = simple toggle no slider, mandatory reduced-motion). Do NOT re-derive styles per session.

## Auto role routing (user does not need to paste a role prompt)

If the user just describes the task without naming a role, pick the role yourself — do not ask them to fill in `session-start-prompt.md`:

1. Infer platform + role from the task using the decision tree in `docs/team/README.md` and the 角色對照 table in `docs/team/session-start-prompt.md`. Examples: bug / 壞掉 → Bug Hunter; 畫面、樣式、響應式、a11y → UI/UX; 新功能且 spec 已存在 → Feature Builder; 沒 spec、排優先、下一步做什麼 → PM; rules / index / functions / schema → Backend; 兩端要不要一起改 → Cross-platform PM. Mentions of iOS / App / iPhone / Expo → the `ios-*` variant; otherwise default to Web/PWA.
2. Treat `docs/team/session-start-prompt.md` (the text block) as the session rules, with the inferred role and the user's description as 本次任務; infer 完成標準 from the task.
3. In the first reply, state in one line: 平台 / 角色 / 本次任務 / 完成標準（推定）, then proceed. Only ask first if the role choice would materially change scope, product decisions, or permissions (e.g. deploy, push, deleting data).
4. If the user names a role explicitly, that wins.

Keep one session to one role. If work crosses role boundaries, do the in-scope part and write a handoff to `docs/team/backlog.md`, `docs/features/*.md`, or `docs/roadmap.md`.
