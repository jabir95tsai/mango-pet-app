<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# apps/web

- Typecheck：`npm run typecheck -w apps/web`（在 repo 根目錄執行）。
- `next.config.ts`、`apphosting.yaml` 和 `package.json` 的 `optionalDependencies` 平台清單會影響 App Hosting（Linux）build；改到這些要走 branch + Linux build gate。
- App Hosting console 上設定的環境變數，優先順序高於 `apphosting.yaml`。
- 驗證 production：用瀏覽器工具開 https://mango-pet--mango-pet-app.asia-east1.hosted.app，看畫面和 console。
