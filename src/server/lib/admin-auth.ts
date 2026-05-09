/**
 * Unified auth helper re-exports.
 * Import from this path for backward compatibility.
 *
 * - requireAdmin, requireModerator → admin/moderator checks
 * - requireAuth → basic session verification (secure DB-lookup version from auth-guard)
 * - requireOwner, requireStoreOwner, requireProductOwner → ownership checks
 */
export { requireAdmin, requireModerator, requireAuth } from '@/server/lib/auth-guard';
export { requireOwner, requireStoreOwner, requireProductOwner } from '@/server/lib/require-auth';
