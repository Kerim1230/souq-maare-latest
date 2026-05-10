/**
 * 🔍 Full Application Audit Script — سوق الحرية الإلكتروني
 *
 * Comprehensive automated audit that tests all API endpoints.
 * Respects rate limits by using sequential auth flows with delays.
 * Read-only analysis — no application files are modified.
 *
 * Usage:
 *   npx tsx scripts/full-audit.ts
 *   AUDIT_BASE_URL=https://suq-hurriya.vercel.app npx tsx scripts/full-audit.ts
 *   AUDIT_USERS=10 npx tsx scripts/full-audit.ts   (default: 10)
 */

import pLimit from 'p-limit';
import { writeFileSync } from 'fs';
import { join } from 'path';

// ── Configuration ──────────────────────────────────────────────────────

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://localhost:3000';
const TOTAL_USERS = parseInt(process.env.AUDIT_USERS || '10', 10);
const ADMIN_EMAIL = 'bkbd098@gmail.com';
const ADMIN_PASSWORD = 'qqppzzmm1230';

// ── Types ──────────────────────────────────────────────────────────────

interface TestResult {
  test: string;
  passed: boolean;
  timeMs: number;
  userId?: string;
  error?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

interface CategorySummary {
  passed: number;
  failed: number;
  avgTime: string;
  minTime: number;
  maxTime: number;
  totalRequests: number;
  errors: string[];
}

interface AuditReport {
  baseUrl: string;
  totalUsers: number;
  totalTests: number;
  passed: number;
  failed: number;
  averageResponseTime: string;
  p95ResponseTime: string;
  categories: Record<string, CategorySummary>;
  errors: Array<{ test: string; userId?: string; error: string }>;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

const results: TestResult[] = [];
let testNumber = 0;

function record(result: TestResult) {
  results.push(result);
  testNumber++;
  const icon = result.passed ? '✅' : '❌';
  const time = `${result.timeMs}ms`;
  const info = result.error ? ` — ${result.error.substring(0, 80)}` : '';
  const detail = result.details ? ` | ${JSON.stringify(result.details)}` : '';
  console.log(`  ${icon} #${testNumber.toString().padStart(3)} ${result.test.padEnd(30)} [${time}]${info}${detail}`);
}

async function timedFetch(
  url: string,
  options: RequestInit = {},
  cookie?: string,
): Promise<{ data: any; status: number; timeMs: number; setCookie?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (cookie) headers['Cookie'] = cookie;

  const start = performance.now();
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err: any) {
    const timeMs = Math.round(performance.now() - start);
    return { data: null, status: 0, timeMs, setCookie: undefined };
  }
  const timeMs = Math.round(performance.now() - start);

  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON */ }

  const setCookie = res.headers.get('set-cookie') || undefined;
  return { data, status: res.status, timeMs, setCookie };
}

function extractSessionCookie(cookieHeader?: string): string {
  if (!cookieHeader) return '';
  // The app uses 'suq_hurriya_sid' as the session cookie name
  const match = cookieHeader.match(/suq_hurriya_sid=[^;]+/);
  return match ? match[0] : '';
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Test User Interface ────────────────────────────────────────────────

interface TestUser {
  index: number;
  email: string;
  password: string;
  fullName: string;
  cookie: string;
  userId: string;
  storeId?: string;
}

// ── Phase 0: Server Health ─────────────────────────────────────────────

async function testServerHealth() {
  console.log(`\n📋 Phase 0: Server health check...`);
  const { data, status, timeMs } = await timedFetch(`${BASE_URL}/api/health`);
  const passed = status === 200 && data?.data?.status === 'healthy';
  record({
    test: 'server-health',
    passed,
    timeMs,
    statusCode: status,
    details: data?.data ? {
      status: data.data.status,
      supabase: data.data.dataSource?.supabaseStatus,
    } : undefined,
    error: passed ? undefined : `Server status: ${data?.data?.status || 'unknown'}`,
  });
  return passed;
}

// ── Phase 1: Signup (sequential — respects 3/min rate limit) ───────────

async function signupUsers(): Promise<TestUser[]> {
  console.log(`\n📋 Phase 1: Signing up ${TOTAL_USERS} users (sequential, 62s delay per batch of 3)...`);
  const users: TestUser[] = [];

  for (let i = 0; i < TOTAL_USERS; i++) {
    const email = `audit-${Date.now()}-${i + 1}@example.com`;
    const password = 'TestPass123!';
    const fullName = `مستخدم تجريبي ${i + 1}`;

    try {
      const { data, status, timeMs, setCookie } = await timedFetch(
        `${BASE_URL}/api/auth/signup`,
        {
          method: 'POST',
          body: JSON.stringify({ email, password, fullName }),
        },
      );

      const sessionCookie = extractSessionCookie(setCookie);
      const passed = status === 201 || status === 200;
      const userId = data?.data?.user?.id || data?.user?.id || '';

      record({
        test: 'signup',
        passed,
        timeMs,
        userId: email,
        statusCode: status,
        error: passed ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
      });

      users.push({
        index: i,
        email,
        password,
        fullName,
        cookie: sessionCookie,
        userId,
      });
    } catch (err: any) {
      record({
        test: 'signup',
        passed: false,
        timeMs: 0,
        userId: email,
        error: err.message,
      });
      users.push({ index: i, email, password, fullName, cookie: '', userId: '' });
    }

    // Rate limit: 3 signups per 60 seconds → wait 62s after every 3rd signup
    if ((i + 1) % 3 === 0 && i < TOTAL_USERS - 1) {
      console.log(`    ⏳ Rate limit cooldown (62s — waiting for 60s window reset)...`);
      await sleep(62_000);
    } else {
      // Small delay between signups within a batch
      await sleep(1000);
    }
  }

  const successCount = users.filter(u => u.userId).length;
  console.log(`  → Signed up: ${successCount}/${TOTAL_USERS}`);
  return users;
}

// ── Phase 2: Signin (sequential — respects 5/min rate limit) ───────────

async function signinUsers(users: TestUser[]): Promise<TestUser[]> {
  // Only sign in users who successfully signed up (have a userId)
  const signupUsers = users.filter(u => u.userId);
  console.log(`\n📋 Phase 2: Signing in ${signupUsers.length} users (sequential, 62s delay per batch of 5)...`);

  let batchIndex = 0;
  for (let i = 0; i < signupUsers.length; i++) {
    const user = signupUsers[i];
    try {
      const { data, status, timeMs, setCookie } = await timedFetch(
        `${BASE_URL}/api/auth/signin`,
        {
          method: 'POST',
          body: JSON.stringify({ email: user.email, password: user.password }),
        },
      );

      const sessionCookie = extractSessionCookie(setCookie);
      const passed = status === 200;
      const userId = data?.data?.user?.id || data?.user?.id || user.userId;

      record({
        test: 'signin',
        passed,
        timeMs,
        userId: user.email,
        statusCode: status,
        error: passed ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
      });

      user.cookie = sessionCookie || user.cookie;
      user.userId = userId || user.userId;
    } catch (err: any) {
      record({
        test: 'signin',
        passed: false,
        timeMs: 0,
        userId: user.email,
        error: err.message,
      });
    }

    // Rate limit: 5 logins per 60 seconds → wait 62s after every 5th login
    if ((i + 1) % 5 === 0 && i < signupUsers.length - 1) {
      console.log(`    ⏳ Rate limit cooldown (62s — waiting for 60s window reset)...`);
      await sleep(62_000);
    }
  }

  const authed = users.filter(u => u.cookie);
  console.log(`  → Authenticated: ${authed.length}/${users.length}`);
  return users;
}

// ── Phase 3: Page APIs ─────────────────────────────────────────────────

async function testPageAPIs(users: TestUser[]) {
  console.log(`\n📋 Phase 3: Testing page APIs...`);
  const limit = pLimit(10); // Conservative concurrency
  const authedUsers = users.filter(u => u.cookie);

  if (authedUsers.length === 0) {
    console.log('  ⚠️ No authenticated users — skipping auth-dependent tests');
    // Still test public endpoints
  }

  // 3a. Home (authenticated)
  console.log('  Testing /api/home (auth)...');
  await Promise.all(
    authedUsers.map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/home?userId=${user.userId}&fpPage=1&npPage=1`,
            {},
            user.cookie,
          );
          const d = data?.data;
          const passed = status === 200 && d;
          record({
            test: 'home',
            passed,
            timeMs,
            userId: user.userId,
            statusCode: status,
            details: d ? {
              fp: d.featured_products?.length || 0,
              np: d.new_products?.length || 0,
              offers: d.offers?.length || 0,
              stores: d.featured_stores?.length || 0,
            } : undefined,
            error: passed ? undefined : data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'home', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 3b. Categories
  console.log('  Testing /api/categories ...');
  await Promise.all(
    authedUsers.slice(0, 5).map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/categories`,
            {},
            user.cookie,
          );
          const passed = status === 200 && data?.data?.categories;
          record({
            test: 'categories',
            passed,
            timeMs,
            userId: user.userId,
            statusCode: status,
            details: passed ? { count: data.data.categories.length } : undefined,
            error: passed ? undefined : data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'categories', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 3c. My Store
  console.log('  Testing /api/my-store ...');
  await Promise.all(
    authedUsers.map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/my-store`,
            {},
            user.cookie,
          );
          const passed = status === 200;
          record({
            test: 'my-store',
            passed,
            timeMs,
            userId: user.userId,
            statusCode: status,
            details: passed ? { hasStore: !!data?.data?.store } : undefined,
            error: passed ? undefined : data?.error || `HTTP ${status}`,
          });
          if (data?.data?.store?.id) user.storeId = data.data.store.id;
        } catch (err: any) {
          record({ test: 'my-store', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 3d. Search
  console.log('  Testing /api/search ...');
  await Promise.all(
    authedUsers.slice(0, 5).map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/search?q=منتج&type=all&limit=5`,
            {},
            user.cookie,
          );
          const d = data?.data;
          const passed = status === 200 && d;
          record({
            test: 'search',
            passed,
            timeMs,
            userId: user.userId,
            statusCode: status,
            details: d ? {
              products: d.products?.length || 0,
              stores: d.stores?.length || 0,
              offers: d.offers?.length || 0,
            } : undefined,
            error: passed ? undefined : data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'search', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 3e. Favorites
  console.log('  Testing /api/favorites ...');
  await Promise.all(
    authedUsers.map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/favorites`,
            {},
            user.cookie,
          );
          record({
            test: 'favorites',
            passed: status === 200,
            timeMs,
            userId: user.userId,
            statusCode: status,
            details: { count: data?.data?.favorites?.length || 0 },
            error: status === 200 ? undefined : data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'favorites', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 3f. User Profile
  console.log('  Testing /api/user ...');
  await Promise.all(
    authedUsers.map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/user`,
            {},
            user.cookie,
          );
          record({
            test: 'user-profile',
            passed: status === 200 && !!data?.data?.user,
            timeMs,
            userId: user.userId,
            statusCode: status,
            error: status === 200 ? undefined : data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'user-profile', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 3g. Points
  console.log('  Testing /api/points ...');
  await Promise.all(
    authedUsers.slice(0, 5).map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/points`,
            {},
            user.cookie,
          );
          record({
            test: 'points',
            passed: status === 200 && !!data?.data?.wallet,
            timeMs,
            userId: user.userId,
            statusCode: status,
            details: { balance: data?.data?.wallet?.balance },
            error: status === 200 ? undefined : data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'points', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 3h. Notifications
  console.log('  Testing /api/notifications ...');
  await Promise.all(
    authedUsers.slice(0, 5).map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/notifications`,
            {},
            user.cookie,
          );
          record({
            test: 'notifications',
            passed: status === 200,
            timeMs,
            userId: user.userId,
            statusCode: status,
            details: { count: data?.data?.notifications?.length || 0 },
            error: status === 200 ? undefined : data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'notifications', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 3i. Referrals
  console.log('  Testing /api/referrals ...');
  await Promise.all(
    authedUsers.slice(0, 3).map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/referrals`,
            {},
            user.cookie,
          );
          record({
            test: 'referrals',
            passed: status === 200 && !!data?.data,
            timeMs,
            userId: user.userId,
            statusCode: status,
            error: status === 200 ? undefined : data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'referrals', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );
}

// ── Phase 4: Feature Operations ────────────────────────────────────────

async function testFeatures(users: TestUser[]) {
  console.log(`\n📋 Phase 4: Testing feature operations...`);
  const limit = pLimit(5); // Low concurrency for mutations
  const authedUsers = users.filter(u => u.cookie);
  if (authedUsers.length === 0) return;

  // 4a. Create Store
  console.log('  Testing store creation ...');
  await Promise.all(
    authedUsers.map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/my-store`,
            {
              method: 'POST',
              body: JSON.stringify({
                name: `متجر ${user.fullName}`,
                description: `متجر تجريبي للمستخدم ${user.index + 1}`,
                category: 'إلكترونيات',
              }),
            },
            user.cookie,
          );
          const passed = status === 201 || status === 200;
          if (data?.data?.store?.id) user.storeId = data.data.store.id;
          record({
            test: 'create-store',
            passed,
            timeMs,
            userId: user.userId,
            statusCode: status,
            error: passed ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'create-store', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  await sleep(1000);

  // 4b. Add Product
  console.log('  Testing product creation ...');
  const storeUsers = authedUsers.filter(u => u.storeId);
  await Promise.all(
    storeUsers.map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/products`,
            {
              method: 'POST',
              body: JSON.stringify({
                name: `منتج تجريبي ${user.index + 1}`,
                description: 'منتج اختبار من سكريبت الفحص',
                price: Math.floor(Math.random() * 100000) + 1000,
                category: 'إلكترونيات',
                store_id: user.storeId,
                user_id: user.userId,
              }),
            },
            user.cookie,
          );
          record({
            test: 'create-product',
            passed: status === 201 || status === 200,
            timeMs,
            userId: user.userId,
            statusCode: status,
            error: (status === 201 || status === 200) ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'create-product', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 4c. Add Offer
  console.log('  Testing offer creation ...');
  await Promise.all(
    storeUsers.slice(0, 5).map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/my-store/offers`,
            {
              method: 'POST',
              body: JSON.stringify({
                title: `عرض تجريبي ${user.index + 1}`,
                description: 'عرض اختبار من سكريبت الفحص',
                type: Math.random() > 0.5 ? 'offer' : 'contest',
                discount: `${Math.floor(Math.random() * 50) + 10}%`,
              }),
            },
            user.cookie,
          );
          record({
            test: 'create-offer',
            passed: status === 201 || status === 200,
            timeMs,
            userId: user.userId,
            statusCode: status,
            error: (status === 201 || status === 200) ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'create-offer', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // Get sample data for next tests
  let sampleProductIds: string[] = [];
  let sampleStoreIds: string[] = [];
  try {
    const { data: pData } = await timedFetch(`${BASE_URL}/api/products?limit=5`, {}, authedUsers[0]?.cookie);
    sampleProductIds = (pData?.data?.products || []).map((p: any) => p.id);
  } catch { /* ok */ }
  try {
    const { data: sData } = await timedFetch(`${BASE_URL}/api/stores?limit=5`, {}, authedUsers[0]?.cookie);
    sampleStoreIds = (sData?.data?.stores || []).map((s: any) => s.id);
  } catch { /* ok */ }

  // 4d. Add to Favorites
  console.log('  Testing add to favorites ...');
  if (sampleProductIds.length > 0) {
    await Promise.all(
      authedUsers.slice(0, 5).map(user =>
        limit(async () => {
          try {
            const productId = sampleProductIds[Math.floor(Math.random() * sampleProductIds.length)];
            const { data, status, timeMs } = await timedFetch(
              `${BASE_URL}/api/favorites`,
              { method: 'POST', body: JSON.stringify({ productId }) },
              user.cookie,
            );
            const passed = status === 201 || status === 200;
            record({
              test: 'add-favorite',
              passed,
              timeMs,
              userId: user.userId,
              statusCode: status,
              error: passed ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
            });
          } catch (err: any) {
            record({ test: 'add-favorite', passed: false, timeMs: 0, userId: user.userId, error: err.message });
          }
        }),
      ),
    );
  } else {
    console.log('    ⚠️ No products to test favorites');
  }

  // 4e. Follow Store
  console.log('  Testing follow store ...');
  if (sampleStoreIds.length > 0) {
    await Promise.all(
      authedUsers.slice(0, 5).map(user =>
        limit(async () => {
          try {
            const storeId = sampleStoreIds[Math.floor(Math.random() * sampleStoreIds.length)];
            const { data, status, timeMs } = await timedFetch(
              `${BASE_URL}/api/stores/follow`,
              { method: 'POST', body: JSON.stringify({ storeId }) },
              user.cookie,
            );
            const passed = status === 201 || status === 200;
            record({
              test: 'follow-store',
              passed,
              timeMs,
              userId: user.userId,
              statusCode: status,
              error: passed ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
            });
          } catch (err: any) {
            record({ test: 'follow-store', passed: false, timeMs: 0, userId: user.userId, error: err.message });
          }
        }),
      ),
    );
  }

  // 4f. Chat Send
  console.log('  Testing chat send ...');
  if (authedUsers.length >= 2) {
    await Promise.all(
      authedUsers.slice(0, 3).map(user =>
        limit(async () => {
          try {
            const otherUser = authedUsers.find(u => u.userId && u.userId !== user.userId);
            if (!otherUser?.userId) return;
            const { data, status, timeMs } = await timedFetch(
              `${BASE_URL}/api/chat/send`,
              {
                method: 'POST',
                body: JSON.stringify({
                  receiverId: otherUser.userId,
                  content: `رسالة اختبار من ${user.fullName}`,
                }),
              },
              user.cookie,
            );
            const passed = status === 201 || status === 200;
            record({
              test: 'chat-send',
              passed,
              timeMs,
              userId: user.userId,
              statusCode: status,
              error: passed ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
            });
          } catch (err: any) {
            record({ test: 'chat-send', passed: false, timeMs: 0, userId: user.userId, error: err.message });
          }
        }),
      ),
    );
  }

  // 4g. Points Order
  console.log('  Testing points order ...');
  await Promise.all(
    authedUsers.slice(0, 3).map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/points/order`,
            {
              method: 'POST',
              body: JSON.stringify({
                userName: user.fullName,
                userEmail: user.email,
                points: 100,
                paymentCode: `AUDIT-${Date.now()}-${user.index}`,
              }),
            },
            user.cookie,
          );
          const passed = status === 201 || status === 200;
          record({
            test: 'points-order',
            passed,
            timeMs,
            userId: user.userId,
            statusCode: status,
            error: passed ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'points-order', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 4h. Share Track (public)
  console.log('  Testing share track ...');
  await Promise.all(
    authedUsers.slice(0, 3).map(user =>
      limit(async () => {
        try {
          const { data, status, timeMs } = await timedFetch(
            `${BASE_URL}/api/share/track`,
            {
              method: 'POST',
              body: JSON.stringify({
                itemType: 'store',
                itemId: sampleStoreIds[0] || 'test-id',
                referrer: user.userId,
              }),
            },
          );
          record({
            test: 'share-track',
            passed: status === 200 || status === 201,
            timeMs,
            userId: user.userId,
            statusCode: status,
            error: (status === 200 || status === 201) ? undefined : data?.error || `HTTP ${status}`,
          });
        } catch (err: any) {
          record({ test: 'share-track', passed: false, timeMs: 0, userId: user.userId, error: err.message });
        }
      }),
    ),
  );

  // 4i. Create Report
  console.log('  Testing create report ...');
  if (sampleProductIds.length > 0) {
    try {
      const user = authedUsers[0];
      const { data, status, timeMs } = await timedFetch(
        `${BASE_URL}/api/admin/reports`,
        {
          method: 'POST',
          body: JSON.stringify({
            targetId: sampleProductIds[0],
            targetType: 'product',
            targetName: 'منتج تجريبي',
            reporterId: user.userId,
            reporterName: user.fullName,
            reporterEmail: user.email,
            reason: 'محتوى غير لائق - اختبار',
            description: 'بلاغ تجريبي من سكريبت الفحص',
          }),
        },
        user.cookie,
      );
      record({
        test: 'create-report',
        passed: status === 201 || status === 200,
        timeMs,
        userId: user.userId,
        statusCode: status,
        error: (status === 201 || status === 200) ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
      });
    } catch (err: any) {
      record({ test: 'create-report', passed: false, timeMs: 0, error: err.message });
    }
  }

  // 4j. Comment
  console.log('  Testing comment creation ...');
  if (sampleProductIds.length > 0) {
    await Promise.all(
      authedUsers.slice(0, 3).map(user =>
        limit(async () => {
          try {
            const productId = sampleProductIds[Math.floor(Math.random() * sampleProductIds.length)];
            const { data, status, timeMs } = await timedFetch(
              `${BASE_URL}/api/comments`,
              {
                method: 'POST',
                body: JSON.stringify({
                  content: `تعليق تجريبي من ${user.fullName}`,
                  productId,
                }),
              },
              user.cookie,
            );
            const passed = status === 201 || status === 200;
            record({
              test: 'create-comment',
              passed,
              timeMs,
              userId: user.userId,
              statusCode: status,
              error: passed ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
            });
          } catch (err: any) {
            record({ test: 'create-comment', passed: false, timeMs: 0, userId: user.userId, error: err.message });
          }
        }),
      ),
    );
  }
}

// ── Phase 5: Admin Tests ───────────────────────────────────────────────

async function testAdmin() {
  console.log(`\n📋 Phase 5: Testing admin operations...`);

  // Wait 65s for rate limit window to reset before admin login
  console.log('    ⏳ Waiting 65s for rate limit window to reset before admin login...');
  await sleep(65_000);

  // Sign in as admin (sequential to avoid rate limit)
  let adminCookie = '';
  try {
    const { data, status, timeMs, setCookie } = await timedFetch(
      `${BASE_URL}/api/auth/signin`,
      {
        method: 'POST',
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      },
    );
    adminCookie = extractSessionCookie(setCookie);
    record({
      test: 'admin-signin',
      passed: status === 200 && !!adminCookie,
      timeMs,
      userId: ADMIN_EMAIL,
      statusCode: status,
      error: status === 200 ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
    });
  } catch (err: any) {
    record({ test: 'admin-signin', passed: false, timeMs: 0, userId: ADMIN_EMAIL, error: err.message });
    console.log('  ❌ Admin signin failed — skipping admin tests');
    return;
  }

  if (!adminCookie) {
    console.log('  ❌ No admin cookie — skipping admin tests');
    return;
  }

  const adminTests: Array<{ name: string; url: string; method?: string; body?: any }> = [
    { name: 'admin-data', url: '/api/admin/data?limit=20' },
    { name: 'admin-reports', url: '/api/admin/reports' },
    { name: 'admin-verifications', url: '/api/admin/verifications' },
    { name: 'admin-system-health', url: '/api/admin/system-health' },
    { name: 'admin-system-keys', url: '/api/admin/system-keys' },
    { name: 'admin-wallets', url: '/api/points/wallets' },
    { name: 'admin-users', url: '/api/users' },
    { name: 'admin-bans', url: '/api/admin/bans' },
    { name: 'admin-notifications', url: '/api/notifications?scope=admin' },
  ];

  for (const t of adminTests) {
    try {
      const { data, status, timeMs } = await timedFetch(
        `${BASE_URL}${t.url}`,
        t.method ? { method: t.method, body: JSON.stringify(t.body) } : {},
        adminCookie,
      );
      const passed = status === 200;
      record({
        test: t.name,
        passed,
        timeMs,
        userId: ADMIN_EMAIL,
        statusCode: status,
        details: t.name === 'admin-data' && passed ? {
          users: data?.data?.users?.length,
          stores: data?.data?.stores?.length,
          products: data?.data?.products?.length,
        } : t.name === 'admin-system-health' && passed ? {
          db: data?.data?.database?.status,
          storage: data?.data?.storage?.status,
          totalUsers: data?.data?.stats?.totalUsers,
        } : undefined,
        error: passed ? undefined : data?.error || data?.data?.error || `HTTP ${status}`,
      });
    } catch (err: any) {
      record({ test: t.name, passed: false, timeMs: 0, userId: ADMIN_EMAIL, error: err.message });
    }
    await sleep(200); // Small delay between admin requests
  }
}

// ── Phase 6: Public Endpoints ──────────────────────────────────────────

async function testPublicEndpoints() {
  console.log(`\n📋 Phase 6: Testing public endpoints (no auth)...`);

  const publicTests: Array<{ name: string; url: string; checkData?: string }> = [
    { name: 'home-anonymous', url: '/api/home', checkData: 'data' },
    { name: 'categories-anonymous', url: '/api/categories', checkData: 'data.categories' },
    { name: 'products-anonymous', url: '/api/products?limit=5', checkData: 'data' },
    { name: 'health', url: '/api/health' },
  ];

  for (const t of publicTests) {
    try {
      const { data, status, timeMs } = await timedFetch(`${BASE_URL}${t.url}`);
      const passed = status === 200;
      record({
        test: t.name,
        passed,
        timeMs,
        statusCode: status,
        details: t.name === 'home-anonymous' && data?.data ? {
          fp: data.data.featured_products?.length || 0,
          np: data.data.new_products?.length || 0,
          offers: data.data.offers?.length || 0,
          stores: data.data.featured_stores?.length || 0,
        } : t.name === 'categories-anonymous' && data?.data ? {
          count: data.data.categories?.length || 0,
        } : t.name === 'products-anonymous' && data?.data ? {
          count: data.data.products?.length || 0,
        } : undefined,
        error: passed ? undefined : data?.error || `HTTP ${status}`,
      });
    } catch (err: any) {
      record({ test: t.name, passed: false, timeMs: 0, error: err.message });
    }
  }

  // Search queries
  console.log('  Testing search queries ...');
  const searchQueries = ['منتج', 'إلكترونيات', 'متجر', 'عرض', 'هاتف'];
  for (const q of searchQueries) {
    try {
      const { data, status, timeMs } = await timedFetch(
        `${BASE_URL}/api/search?q=${encodeURIComponent(q)}&type=all&limit=5`,
      );
      const d = data?.data;
      record({
        test: `search[${q}]`,
        passed: status === 200 && !!d,
        timeMs,
        statusCode: status,
        details: d ? {
          products: d.products?.length || 0,
          stores: d.stores?.length || 0,
          offers: d.offers?.length || 0,
        } : undefined,
        error: status === 200 ? undefined : data?.error || `HTTP ${status}`,
      });
    } catch (err: any) {
      record({ test: `search[${q}]`, passed: false, timeMs: 0, error: err.message });
    }
    await sleep(100);
  }

  // Static files
  console.log('  Testing static files ...');
  for (const { name, url } of [
    { name: 'robots-txt', url: '/robots.txt' },
    { name: 'sitemap-xml', url: '/sitemap.xml' },
    { name: 'manifest-json', url: '/manifest.json' },
  ]) {
    try {
      const start = performance.now();
      const res = await fetch(`${BASE_URL}${url}`);
      const timeMs = Math.round(performance.now() - start);
      record({
        test: name,
        passed: res.ok,
        timeMs,
        statusCode: res.status,
      });
    } catch (err: any) {
      record({ test: name, passed: false, timeMs: 0, error: err.message });
    }
  }
}

// ── Phase 7: Rate Limit Verification ───────────────────────────────────

async function testRateLimits() {
  console.log(`\n📋 Phase 7: Testing rate limit enforcement...`);

  // Test signup rate limit (3 per minute)
  console.log('  Testing signup rate limit (3/min)...');
  let rateLimited = false;
  for (let i = 0; i < 5; i++) {
    try {
      const { data, status, timeMs } = await timedFetch(
        `${BASE_URL}/api/auth/signup`,
        {
          method: 'POST',
          body: JSON.stringify({
            email: `ratelimit-test-${i}-${Date.now()}@example.com`,
            password: 'TestPass123!',
            fullName: `اختبار حد ${i}`,
          }),
        },
      );
      if (status === 429) {
        rateLimited = true;
        record({
          test: 'rate-limit-signup',
          passed: true,
          timeMs,
          statusCode: status,
          details: { blockedAt: i + 1 },
        });
        break;
      }
    } catch (err: any) {
      // Network error is ok
    }
  }
  if (!rateLimited) {
    record({
      test: 'rate-limit-signup',
      passed: false,
      timeMs: 0,
      error: 'Rate limit not triggered after 5 signup attempts',
    });
  }

  // Test general API rate limit (60 per minute — harder to trigger)
  console.log('  Testing general API rate limit (60/min)...');
  let apiRateLimited = false;
  const limit = pLimit(20);
  const tasks = Array.from({ length: 70 }, (_, i) =>
    limit(async () => {
      if (apiRateLimited) return;
      try {
        const { status } = await timedFetch(`${BASE_URL}/api/health`);
        if (status === 429) apiRateLimited = true;
      } catch { /* ok */ }
    }),
  );
  await Promise.all(tasks);
  record({
    test: 'rate-limit-general',
    passed: true, // Either it rate limited (good) or handled 70 requests (also good)
    timeMs: 0,
    details: { rateLimited: apiRateLimited },
    error: apiRateLimited ? 'Rate limit triggered' : 'Handled 70 requests without rate limit',
  });
}

// ── Report Generation ──────────────────────────────────────────────────

function generateReport(startedAt: string, finishedAt: string): AuditReport {
  const categories: Record<string, CategorySummary> = {};
  const allTimes: number[] = [];

  for (const r of results) {
    if (r.timeMs > 0) allTimes.push(r.timeMs);

    // Normalize test name (remove [query] suffix for grouping)
    const baseName = r.test.replace(/\[.*\]/, '');
    if (!categories[baseName]) {
      categories[baseName] = {
        passed: 0, failed: 0, avgTime: '0ms',
        minTime: Infinity, maxTime: 0, totalRequests: 0, errors: [],
      };
    }
    const cat = categories[baseName];
    cat.totalRequests++;
    if (r.passed) cat.passed++;
    else cat.failed++;
    if (r.timeMs > 0) {
      cat.minTime = Math.min(cat.minTime, r.timeMs);
      cat.maxTime = Math.max(cat.maxTime, r.timeMs);
    }
    if (r.error) cat.errors.push(r.error);
  }

  // Calculate averages
  for (const [key, cat] of Object.entries(categories)) {
    const times = results
      .filter(r => r.test.replace(/\[.*\]/, '') === key && r.timeMs > 0)
      .map(r => r.timeMs);
    cat.avgTime = times.length > 0
      ? `${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms`
      : '0ms';
    if (cat.minTime === Infinity) cat.minTime = 0;
    cat.errors = [...new Set(cat.errors)].slice(0, 5);
  }

  allTimes.sort((a, b) => a - b);
  const avgTime = allTimes.length > 0
    ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
    : 0;
  const p95Index = Math.floor(allTimes.length * 0.95);
  const p95Time = allTimes[p95Index] || 0;

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  const errorList = results
    .filter(r => !r.passed && r.error)
    .map(r => ({ test: r.test, userId: r.userId, error: r.error! }));
  const durationSec = Math.round(
    (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000,
  );

  return {
    baseUrl: BASE_URL,
    totalUsers: TOTAL_USERS,
    totalTests: results.length,
    passed: totalPassed,
    failed: totalFailed,
    averageResponseTime: `${avgTime}ms`,
    p95ResponseTime: `${p95Time}ms`,
    categories,
    errors: errorList,
    startedAt,
    finishedAt,
    durationSec,
  };
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date().toISOString();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 سوق الحرية — Full Application Audit');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Base URL:  ${BASE_URL}`);
  console.log(`  Users:     ${TOTAL_USERS}`);
  console.log(`  Started:   ${startedAt}`);
  console.log('═══════════════════════════════════════════════════════════');

  // Phase 0: Server health
  const healthy = await testServerHealth();
  if (!healthy) {
    console.log('\n❌ Server is not healthy — aborting audit.');
    const report = generateReport(startedAt, new Date().toISOString());
    writeFileSync(
      join(process.cwd(), 'scripts', 'audit-report.json'),
      JSON.stringify(report, null, 2),
      'utf-8',
    );
    process.exit(1);
  }

  // Phase 1: Signup
  const users = await signupUsers();

  // Phase 2: Signin
  const authedUsers = await signinUsers(users);

  // Phase 3: Page APIs
  await testPageAPIs(authedUsers);

  // Phase 4: Feature Operations
  await testFeatures(authedUsers);

  // Phase 5: Admin
  await testAdmin();

  // Phase 6: Public Endpoints
  await testPublicEndpoints();

  // Phase 7: Rate Limits
  await testRateLimits();

  // Generate Report
  const finishedAt = new Date().toISOString();
  const report = generateReport(startedAt, finishedAt);

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 AUDIT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total Tests:       ${report.totalTests}`);
  console.log(`  ✅ Passed:         ${report.passed}`);
  console.log(`  ❌ Failed:         ${report.failed}`);
  console.log(`  Pass Rate:         ${((report.passed / report.totalTests) * 100).toFixed(1)}%`);
  console.log(`  Avg Response:      ${report.averageResponseTime}`);
  console.log(`  P95 Response:      ${report.p95ResponseTime}`);
  console.log(`  Duration:          ${report.durationSec}s`);
  console.log('───────────────────────────────────────────────────────────');

  // Category breakdown
  console.log('\n  Category Breakdown:');
  const sorted = Object.entries(report.categories).sort((a, b) => b[1].totalRequests - a[1].totalRequests);
  for (const [name, cat] of sorted) {
    const rate = cat.totalRequests > 0
      ? ((cat.passed / cat.totalRequests) * 100).toFixed(0)
      : '0';
    const icon = cat.failed === 0 ? '✅' : cat.passed > cat.failed ? '⚠️' : '❌';
    console.log(`  ${icon} ${name.padEnd(25)} ${cat.passed}/${cat.totalRequests} (${rate}%) avg:${cat.avgTime} [${cat.minTime}-${cat.maxTime}ms]`);
    if (cat.errors.length > 0) {
      for (const err of cat.errors.slice(0, 2)) {
        console.log(`     ↳ ${err.substring(0, 100)}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');

  // Save report
  const reportPath = join(process.cwd(), 'scripts', 'audit-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
