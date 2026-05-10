export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { success, serverError, forbidden } from '@/lib/api-response';

/**
 * One-time migration: Add `location` column to stores table.
 * 
 * This route tries multiple approaches:
 * 1. Check if column already exists via Supabase REST API
 * 2. Try connecting to PostgreSQL directly via IPv6 (Vercel has IPv6 support)
 * 3. Try connecting via Supabase pooler with SUPABASE_DB_PASSWORD env var
 * 
 * Call: POST /api/migrate?secret=add-location-2024
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== 'add-location-2024') {
      return forbidden('Invalid migration secret');
    }

    const { getSupabaseAdmin, TABLES } = await import('@/lib/supabase-db');
    const sb = getSupabaseAdmin();
    
    // Check if column already exists
    const { error: checkError } = await sb
      .from(TABLES.STORES)
      .select('location')
      .limit(1);

    if (!checkError) {
      return success({ message: 'Column "location" already exists', alreadyExists: true });
    }

    const pg = await import('pg');
    const Client = pg.Client;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
    const dbPassword = process.env.SUPABASE_DB_PASSWORD;
    const errors: string[] = [];

    // Approach 1: Direct connection via IPv6 (works on Vercel)
    if (dbPassword) {
      const directConnStr = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;
      const client = new Client({ 
        connectionString: directConnStr, 
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });
      try {
        await client.connect();
        await client.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS location TEXT');
        const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'location'");
        await client.end();
        if (result.rows.length > 0) {
          return success({ message: 'Column added via direct connection', method: 'direct-ipv6' });
        }
      } catch (err: any) {
        errors.push(`direct: ${err.message}`);
        try { await client.end(); } catch {}
      }

      // Approach 2: Pooler connection
      const regions = ['us-east-1', 'us-east-2', 'us-west-1', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'];
      for (const region of regions) {
        const connStr = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
        const client2 = new Client({ 
          connectionString: connStr, 
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 8000,
        });
        try {
          await client2.connect();
          await client2.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS location TEXT');
          const result = await client2.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'location'");
          await client2.end();
          if (result.rows.length > 0) {
            return success({ message: 'Column added via pooler', method: `pooler-${region}` });
          }
        } catch (err: any) {
          errors.push(`pooler-${region}: ${err.message}`);
          try { await client2.end(); } catch {}
        }
      }
    }

    if (!dbPassword) {
      return serverError('SUPABASE_DB_PASSWORD not set. Please add it to Vercel env vars or run this SQL in Supabase Dashboard: ALTER TABLE stores ADD COLUMN IF NOT EXISTS location TEXT;');
    }

    return serverError(`All connection attempts failed: ${errors.join('; ')}`);
  } catch (error) {
    return serverError('Migration failed: ' + (error as Error)?.message);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { getSupabaseAdmin, TABLES } = await import('@/lib/supabase-db');
    const sb = getSupabaseAdmin();
    const { error: checkError } = await sb
      .from(TABLES.STORES)
      .select('location')
      .limit(1);
    return success({ columnExists: !checkError, error: checkError?.message || null });
  } catch (error) {
    return serverError('Check failed: ' + (error as Error)?.message);
  }
}
