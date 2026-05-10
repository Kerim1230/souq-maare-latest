---
Task ID: 1
Agent: Main Agent
Task: Fix persistent hydration mismatch error (سوق الحرية vs سوق شامل) - SECOND ATTEMPT

Work Log:
- Analyzed the root cause more deeply: The old Service Worker's `cacheFirst` strategy for `/_next/static/` assets serves old cached JS bundles containing "سوق الحرية". The browser runs this old JS during React hydration, causing mismatch against new server HTML.
- Previous fix (client-only SplashScreen text) was correct but ineffective because the BROWSER IS STILL RUNNING OLD CACHED JS - the old JS doesn't have our fix.
- Discovered that the PwaInstallListener's `scriptURL.includes('suq-shamel')` check was BROKEN - all SWs have URL `/sw.js`, which never contains 'suq-shamel'. This means the check always returned true, potentially unregistering the new SW too.
- Implemented a 3-layer comprehensive fix:
  1. Inline migration script in layout.tsx that runs BEFORE React hydrates - detects old SWs via localStorage flag, unregisters ALL SWs, clears ALL caches, reloads page
  2. Clear-Site-Data: "cache" header in proxy.ts - forces browser to clear SW Cache Storage on every root page response
  3. Simplified PwaInstallListener - removed broken scriptURL check, now just handles SW registration and updates (migration is handled by inline script)
- Bumped CACHE_NAME to v2 in sw.js
- Kept client-only SplashScreen rendering as additional safety net
- Removed conflicting middleware.ts (Next.js 16 uses proxy.ts, not middleware.ts - caused crash)
- Server is running and verified: migration script is in HTML, Clear-Site-Data header present, no old name references

Stage Summary:
- **layout.tsx**: Added inline `<script>` in `<head>` that runs before React hydrates to force SW migration
- **proxy.ts**: Added `Clear-Site-Data: "cache"` header for root page responses
- **PwaInstallListener.tsx**: Simplified to just register SW and handle updates (migration handled by inline script)
- **sw.js**: CACHE_NAME bumped to v2, aggressive old cache deletion on activate
- **page.tsx**: SplashScreen uses client-only text rendering (useState + useEffect pattern)
- **middleware.ts**: Removed (conflicts with proxy.ts in Next.js 16)
- The hydration error should be resolved: on first load, inline script detects old SW, clears everything, reloads; on second load, fresh JS is loaded without old SW interference
