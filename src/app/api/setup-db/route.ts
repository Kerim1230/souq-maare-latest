export const runtime = 'nodejs';
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { getSupabaseAdmin, TABLES } from '@/lib/supabase-db';
import { success } from '@/lib/api-response';
import { logger } from '@/lib/logger';

/**
 * POST /api/setup-db
 *
 * One-time setup endpoint that ensures all required database tables and columns
 * exist.  Only accessible by admins.
 *
 * This is idempotent — safe to call multiple times.
 */
export const POST = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  const sb = getSupabaseAdmin();
  const results: { table: string; action: string; status: string; error?: string }[] = [];

  // ── 1. Check / create support_tickets table ──
  try {
    const { error } = await sb.from(TABLES.SUPPORT_TICKETS).select('id').limit(1);
    if (error && error.message?.includes('Could not find the table')) {
      // Table doesn't exist — we can't create it via REST, log the SQL needed
      results.push({
        table: 'support_tickets',
        action: 'CREATE TABLE (manual SQL required)',
        status: 'MISSING',
        error: 'Run the SQL below in Supabase SQL Editor',
      });
    } else {
      results.push({ table: 'support_tickets', action: 'check', status: 'EXISTS' });
    }
  } catch (err: any) {
    results.push({ table: 'support_tickets', action: 'check', status: 'ERROR', error: err.message });
  }

  // ── 2. Check verifications.tier column ──
  try {
    const { error } = await sb
      .from(TABLES.VERIFICATIONS)
      .insert({
        store_id: '00000000-0000-0000-0000-000000000000',
        user_id: '00000000-0000-0000-0000-000000000000',
        store_name: '__schema_check__',
        tier: 'bronze',
        is_active: false,
      })
      .select();

    if (error && error.message?.includes('tier')) {
      results.push({
        table: 'verifications.tier',
        action: 'ADD COLUMN (manual SQL required)',
        status: 'MISSING',
        error: 'Run: ALTER TABLE verifications ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT \'bronze\';',
      });
    } else {
      // Column exists, clean up test row
      await sb.from(TABLES.VERIFICATIONS).delete().eq('store_name', '__schema_check__');
      results.push({ table: 'verifications.tier', action: 'check', status: 'EXISTS' });
    }
  } catch (err: any) {
    results.push({ table: 'verifications.tier', action: 'check', status: 'ERROR', error: err.message });
  }

  // ── 3. Check verification_activity_log table ──
  try {
    const { error } = await sb.from(TABLES.VERIFICATION_ACTIVITY_LOGS).select('id').limit(1);
    if (error) {
      results.push({
        table: 'verification_activity_log',
        action: 'check',
        status: 'ERROR',
        error: error.message,
      });
    } else {
      results.push({ table: 'verification_activity_log', action: 'check', status: 'EXISTS' });
    }
  } catch (err: any) {
    results.push({ table: 'verification_activity_log', action: 'check', status: 'ERROR', error: err.message });
  }

  // ── Build SQL commands for manual execution ──
  const missingItems = results.filter(r => r.status === 'MISSING');
  const sqlCommands: string[] = [];

  if (missingItems.some(r => r.table === 'support_tickets')) {
    sqlCommands.push(`
-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own tickets
CREATE POLICY "Users can create their own tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own tickets
CREATE POLICY "Users can read their own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role full access" ON support_tickets
  FOR ALL USING (true) WITH CHECK (true);
`.trim());
  }

  if (missingItems.some(r => r.table === 'verifications.tier')) {
    sqlCommands.push(`
-- Add tier column to verifications table
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'bronze';
`.trim());
  }

  logger.info('DB setup check completed', 'SetupDB', { results, sqlNeeded: sqlCommands.length });

  return success({
    message: sqlCommands.length > 0
      ? 'بعض الجداول/الأعمدة مفقودة. شغّل الأوامر SQL أدناه في Supabase SQL Editor.'
      : 'جميع الجداول والأعمدة موجودة ✅',
    results,
    sqlCommands,
    sqlEditorUrl: 'https://supabase.com/dashboard/project/frnciyaigyldpihxwnbt/sql',
  });
});
