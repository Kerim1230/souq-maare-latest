const BASE = 'https://souq-maare-latest.vercel.app';

async function main() {
  console.log('═══ Quick Audit: souq-maare-latest.vercel.app ═══\n');

  // Public endpoints
  await t('health', '/api/health');
  await t('home', '/api/home');
  await t('categories', '/api/categories');
  await t('search', '/api/search?q=%D9%85%D9%86%D8%AA%D8%AC&type=all&limit=5');
  await t('products', '/api/products?limit=5');
  await t('stores', '/api/stores?limit=5');
  await t('offers', '/api/offers');

  // Static files
  console.log('\n--- Static Files ---');
  await t('robots.txt', '/robots.txt');
  await t('sitemap.xml', '/sitemap.xml');
  await t('manifest.json', '/manifest.json');

  // Admin login
  console.log('\n--- Admin Tests ---');
  const signinRes = await fetch(BASE + '/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bkbd098@gmail.com', password: 'qqppzzmm1230' }),
  });
  const signinData = await signinRes.json().catch(() => null);
  const ok = signinRes.ok;
  console.log(ok ? '✅' : '❌', 'admin-signin'.padEnd(35), `HTTP ${signinRes.status}`);

  const setCookie = signinRes.headers.getSetCookie?.()?.[0] || signinRes.headers.get('set-cookie') || '';
  console.log('  Debug: set-cookie =', setCookie.substring(0, 80));
  const sidMatch = setCookie.match(/suq_maraa_sid=[^;]+/);
  const sid = sidMatch ? sidMatch[0] : '';

  if (sid) {
    const h = { Cookie: sid };
    await t('admin-data', '/api/admin/data?limit=10', h);
    await t('admin-system-health', '/api/admin/system-health', h);
    await t('admin-reports', '/api/admin/reports', h);
    await t('admin-verifications', '/api/admin/verifications', h);
    await t('admin-bans', '/api/admin/bans', h);
    await t('admin-wallets', '/api/points/wallets', h);
    await t('admin-users', '/api/users', h);
    await t('user-profile', '/api/user', h);
    await t('my-store', '/api/my-store', h);
    await t('favorites', '/api/favorites', h);
    await t('notifications', '/api/notifications', h);
    await t('points', '/api/points', h);
    await t('referrals', '/api/referrals', h);
  } else {
    console.log('❌ Admin cookie not extracted, skipping admin tests');
  }

  console.log('\n═══ DONE ═══');
}

async function t(name, path, headers?: any) {
  try {
    const start = performance.now();
    const res = await fetch(BASE + path, { headers });
    const time = Math.round(performance.now() - start);
    const ok = res.ok;
    console.log(ok ? '✅' : '❌', name.padEnd(35), `${time}ms`.padStart(8), `HTTP ${res.status}`);
    if (ok && name === 'home') {
      const data = await res.json().catch(() => null);
      const d = data?.data;
      if (d) console.log('   →', `fp:${d.featured_products?.length} np:${d.new_products?.length} offers:${d.offers?.length} stores:${d.featured_stores?.length}`);
    }
    if (ok && name === 'admin-system-health') {
      const data = await res.json().catch(() => null);
      const d = data?.data;
      if (d) console.log('   →', `db:${d.database?.status} storage:${d.storage?.status} users:${d.stats?.totalUsers} stores:${d.stats?.totalStores}`);
    }
  } catch(e: any) {
    console.log('❌', name.padEnd(35), 'FAILED ', e.message);
  }
}

main().catch(console.error);
