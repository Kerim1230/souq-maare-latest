// Supabase client library for Next.js 16
// Re-exports all Supabase client utilities for convenient imports

export { createClient, createRouteHandlerClient, getSupabaseRouteClient, isSupabaseConfigured, resolveSupabaseKeys, clearSupabaseKeyCache } from './server'
export { createBrowserSupabaseClient } from './client'
export { updateSession } from './middleware'
export { createAdminClient } from './admin'
