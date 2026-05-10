---
Task ID: 1
Agent: Main Agent
Task: Fix "Failed to load chunk" error and search page issues in سوق شامل app

Work Log:
- Read and analyzed SearchScreen.tsx, page.tsx, sw.js, layout.tsx, proxy.ts, and all API routes
- Diagnosed chunk loading error: caused by stale service worker cache and missing unhandledrejection handler
- Fixed chunk error recovery in page.tsx: added unhandledrejection listener for dynamic import failures + reload loop protection (max 3 reloads in 60s)
- Bumped service worker cache version from v5 to v6 in public/sw.js
- Updated SW migration script from v5 to v6 in src/app/layout.tsx
- Added initialError state and retry button in SearchScreen.tsx
- Added retryInitialLoad callback for manual retry when all initial API requests fail
- Updated all content sections in SearchScreen to hide when initialError is set
- Committed and pushed all changes to GitHub (commit df41c61)
- Deployed to Vercel project souq-maare-latest at https://suq-shamel.vercel.app
- Verified production deployment: health API, search API, products API, and stores API all working

Stage Summary:
- Build succeeded on Vercel with Next.js 16.2.6 (Turbopack)
- Production URL: https://suq-shamel.vercel.app
- Key fixes:
  1. Chunk error recovery now handles both window.error and unhandledrejection events
  2. Reload loop protection prevents infinite refresh cycles
  3. Service worker cache migration v5→v6 forces all users to clear cached chunks
  4. SearchScreen shows error state with retry button when initial load fails
  5. All API routes verified working on production
