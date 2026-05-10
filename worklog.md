---
Task ID: 1
Agent: Main Agent
Task: Fix persistent hydration mismatch error (سوق الحرية vs سوق شامل)

Work Log:
- Analyzed root cause: Browser's old Service Worker was serving cached JS bundles containing "سوق الحرية" while SSR rendered "سوق شامل"
- Previous attempts (clean .next, hard refresh) failed because old SW caches persisted in browser
- Fixed SplashScreen to use client-only rendering: useState(false) + useEffect to set showText=true after mount
  - During SSR and initial client render: no text is rendered (empty placeholder div)
  - After hydration completes: APP_NAME and APP_SUBTITLE render on client only
  - This eliminates the hydration mismatch entirely since both server and client render the same initial state
- Bumped CACHE_NAME from 'suq-shamel-v1' to 'suq-shamel-v2' to force SW cache invalidation
- Enhanced SW activate handler to aggressively delete ALL old caches (including suq-hurriya-v1) with console logging
- Updated PwaInstallListener with 3-step migration:
  1. Force-unregister ALL old service workers (checking active/installing/waiting scriptURLs)
  2. Direct cache cleanup from page (delete suq-hurriya* and old suq-shamel-v1 caches)
  3. Register new SW with forced update check and skipWaiting on install
- Cleaned .next cache and restarted dev server
- Verified: HTML contains "سوق شامل" with zero instances of "الحرية"

Stage Summary:
- SplashScreen hydration-safe: text only renders after useEffect fires (post-hydration)
- SW cache v2: all old caches deleted on activate
- PwaInstallListener: comprehensive migration from old SW to new
- Dev server running on port 3000, serving correct content
