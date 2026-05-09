import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getKeyValue } from '@/server/lib/external-keys'

// ── Conditional Supabase Configuration ──────────────────────────────────
// Resolves Supabase credentials from env vars first, then encrypted settings.
// Returns null if Supabase is not configured.

interface ResolvedKeys {
  url: string
  anonKey: string
  serviceRoleKey?: string
}

let cachedKeys: ResolvedKeys | null = null
let keysChecked = false

/**
 * Resolve Supabase keys from environment variables first,
 * then from encrypted settings in the database.
 * Returns null if any required key is missing.
 */
export async function resolveSupabaseKeys(): Promise<ResolvedKeys | null> {
  if (keysChecked && cachedKeys) return cachedKeys
  if (keysChecked && !cachedKeys) return null

  // 1) Try environment variables first
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  // 2) Fall back to encrypted settings in the database
  if (!url || !anonKey) {
    try {
      const [dbUrl, dbAnonKey, dbServiceKey] = await Promise.all([
        getKeyValue('SUPABASE_URL'),
        getKeyValue('SUPABASE_ANON_KEY'),
        getKeyValue('SUPABASE_SERVICE_ROLE_KEY'),
      ])

      url = url || dbUrl || ''
      anonKey = anonKey || dbAnonKey || ''
      serviceRoleKey = serviceRoleKey || dbServiceKey || ''
    } catch (err) {
      console.error('[supabase/server] Failed to read encrypted settings:', err)
    }
  }

  // 3) Validate — URL and anon key are required
  if (!url || !anonKey || url === 'placeholder' || anonKey === 'placeholder' ||
      url.includes('your-project') || anonKey.includes('your-')) {
    keysChecked = true
    cachedKeys = null
    return null
  }

  const keys: ResolvedKeys = { url, anonKey, serviceRoleKey: serviceRoleKey || undefined }
  cachedKeys = keys
  keysChecked = true
  return keys
}

/**
 * Check if Supabase is configured without throwing.
 * Returns true if URL and anon key are available.
 */
export async function isSupabaseConfigured(): Promise<boolean> {
  const keys = await resolveSupabaseKeys()
  return !!keys
}

/**
 * Clear the cached Supabase keys.
 * Call this after updating Supabase settings so the next
 * operation picks up the new values.
 */
export function clearSupabaseKeyCache(): void {
  cachedKeys = null
  keysChecked = false
}

// ── SSR Client (for Server Components) ──────────────────────────────────

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}

// ── Route Handler Client (for API routes) ───────────────────────────────
// Pass a NextResponse (scratch response) so Supabase can write session
// cookies via setAll. After the auth operation, copy cookies from scratch
// to your actual API response using `copyCookies()`.

export function createRouteHandlerClient(request: NextRequest, response?: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get('cookie') || ''
          return cookieHeader.split(';').map(c => {
            const [name, ...rest] = c.trim().split('=')
            return { name, value: rest.join('=') }
          }).filter(c => c.name.startsWith('sb-'))
        },
        setAll(cookiesToSet) {
          if (response) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          }
        },
      },
    }
  )
}

// ── Conditional Route Handler Client ────────────────────────────────────
// Returns null if Supabase is not configured, otherwise returns a client
// that can be used for auth operations. Use this in dual-mode routes.

export async function getSupabaseRouteClient(
  request: NextRequest,
  response?: NextResponse
): Promise<ReturnType<typeof createRouteHandlerClient> | null> {
  const keys = await resolveSupabaseKeys()
  if (!keys) return null

  return createServerClient(
    keys.url,
    keys.anonKey,
    {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get('cookie') || ''
          return cookieHeader.split(';').map(c => {
            const [name, ...rest] = c.trim().split('=')
            return { name, value: rest.join('=') }
          }).filter(c => c.name.startsWith('sb-'))
        },
        setAll(cookiesToSet) {
          if (response) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          }
        },
      },
    }
  )
}
