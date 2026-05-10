export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { success, serverError, forbidden } from '@/lib/api-response';

/**
 * One-time migration: Add `location` column to stores table.
 * This route should be called once after deployment, then can be removed.
 * 
 * Uses pg module to connect to Supabase PostgreSQL directly.
 * The connection string is constructed from environment variables.
 */
export async function POST(request: NextRequest) {
  try {
    // Simple auth check - require a secret query param
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== 'add-location-2024') {
      return forbidden('Invalid migration secret');
    }

    // First, check if the column already exists using the Supabase client
    const { getSupabaseAdmin, TABLES } = await import('@/lib/supabase-db');
    const sb = getSupabaseAdmin();
    
    const { error: checkError } = await sb
      .from(TABLES.STORES)
      .select('location')
      .limit(1);

    if (!checkError) {
      return success({ message: 'Column "location" already exists in stores table', alreadyExists: true });
    }

    // Column doesn't exist. Try to add it using pg module with direct connection.
    const { Client } = await import('pg');
    
    // Construct the connection string from Supabase URL
    // Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
    
    // Try different regions for the pooler
    const regions = ['us-east-1', 'us-east-2', 'us-west-1', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'];
    
    for (const region of regions) {
      // Try with the database password from env if available
      const dbPassword = process.env.SUPABASE_DB_PASSWORD;
      if (!dbPassword) {
        continue;
      }
      
      const connStr = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
      const client = new Client({ 
        connectionString: connStr, 
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      });
      
      try {
        await client.connect();
        await client.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS location TEXT');
        
        // Verify
        const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'location'");
        await client.end();
        
        if (result.rows.length > 0) {
          return success({ 
            message: 'Column "location" added successfully to stores table', 
            region,
            verified: true 
          });
        }
      } catch (err: any) {
        try { await client.end(); } catch {}
        // Continue to next region
      }
    }

    // If we get here, direct connection failed
    // Return instructions for manual migration
    return serverError('Could not add column automatically. Please run this SQL in the Supabase Dashboard SQL editor: ALTER TABLE stores ADD COLUMN IF NOT EXISTS location TEXT;');
  } catch (error) {
    return serverError('Migration failed: ' + (error as Error)?.message);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { getSupabaseAdmin, TABLES } = await import('@/lib/supabase-db');
    const sb = getSupabaseAdmin();

    // Check if the column exists
    const { error: checkError } = await sb
      .from(TABLES.STORES)
      .select('location')
      .limit(1);

    return success({
      columnExists: !checkError,
      error: checkError?.message || null,
    });
  } catch (error) {
    return serverError('Check failed: ' + (error as Error)?.message);
  }
}
