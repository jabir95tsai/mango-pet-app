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

Keep one session to one role. If work crosses role boundaries, do the in-scope part and write a handoff to `docs/team/backlog.md`, `docs/features/*.md`, or `docs/roadmap.md`.
