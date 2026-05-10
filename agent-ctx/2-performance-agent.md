# Task 2: Fix Homepage Load Delay

## Agent: Performance Agent

## Changes Made

### 1. `src/app/page.tsx` — Parallel Global Data Loading
- Changed sequential `await` calls (favorites → followedStores → wallet) to parallel `Promise.all`
- Merged the separate notifications `useEffect` into the parallel loader
- Removed the redundant notifications `useEffect` block (was lines 349-357)

### 2. `src/app/api/home/route.ts` — Reduced Initial Items & Fixed Pagination Offset
- `NEW_PRODUCTS_LIMIT`: 6 → 3
- Removed unused `PRODUCTS_PER_PAGE = 10` constant
- Fixed offset calculation: now uses `FEATURED_PRODUCTS_LIMIT` and `NEW_PRODUCTS_LIMIT` instead of hardcoded `PRODUCTS_PER_PAGE`

### 3. `src/app/api/home/route.ts` — Parallelized User-Specific Queries
- Follower counts query and user follow status query now run in parallel via `Promise.all`
- When follower counts are cached, the cache branch returns `Promise.resolve(null)` to skip the query

### 4. `src/screens/HomeScreen.tsx` — Reduced New Products Display
- `newProducts.slice(0, 4)` → `newProducts.slice(0, 3)` for consistency with API limit

## Verification
- `bun run lint`: 0 errors, 9 warnings (all pre-existing)
- Dev server running successfully on port 3000
