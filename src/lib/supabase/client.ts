import { createBrowserClient } from '@supabase/ssr'

/**
 * Check if Supabase client-side env vars are available.
 * Returns true if both NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are set and not placeholders.
 */
export function isSupabaseClientConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  return !!(
    url &&
    anonKey &&
    url !== 'placeholder' &&
    anonKey !== 'placeholder' &&
    !url.includes('your-project') &&
    !anonKey.includes('your-')
  )
}

/**
 * Create a Supabase browser client for client-side usage.
 * Returns null if Supabase is not configured on the client side.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
