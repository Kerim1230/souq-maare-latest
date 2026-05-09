export const runtime = 'nodejs'
import { success } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, TABLES } from '@/lib/supabase-db';

/**
 * Health Check Endpoint — Supabase Mode
 *
 * Returns system status for the Supabase/PostgreSQL stack.
 * No external services are used.
 */
export const GET = withRoute(async () => {
  // Test Supabase connectivity
  let supabaseStatus: 'ok' | 'error' = 'ok';
  let supabaseError: string | null = null;

  try {
    const sb = getSupabaseAdmin();
    await sb.from(TABLES.USERS).select('id', { count: 'exact', head: true });
  } catch (err) {
    supabaseStatus = 'error';
    supabaseError = err instanceof Error ? err.message : String(err);
  }

  return success({
    status: supabaseStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: 'supabase',

    // Data source
    dataSource: {
      mode: 'supabase',
      supabaseStatus,
      supabaseError,
    },

    validation: {
      valid: true,
      errors: [],
      warnings: [],
    },
  });
})
