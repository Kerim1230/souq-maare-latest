import type { NextRequest } from 'next/server';
import { findActiveBan, updateBan } from '@/lib/supabase-db';

type BanType = 'login' | 'post' | 'edit' | 'message' | 'full';

export interface BanCheckResult {
  isBanned: boolean;
  banType?: string;
  reason?: string;
  expiresAt?: string;
}

// Ban type -> action mapping
const BAN_ACTION_MAP: Record<string, BanType[]> = {
  login: ['login', 'full'],
  post: ['post', 'full'],
  edit: ['edit', 'full'],
  message: ['message', 'full'],
};

// In-memory cache of active bans (populated from DB queries)
const banCache = new Map<string, { banType: string; reason: string; expiresAt: string }>();

/**
 * Update the ban cache (called by API routes after fetching ban status from DB)
 */
export function setBanCache(userId: string, banType: string, reason: string, expiresAt: string): void {
  banCache.set(userId, { banType, reason, expiresAt });
  // 🔴 FIX: Evict oldest entries when cache grows too large (prevent memory leak)
  if (banCache.size > 5000) {
    let count = 0;
    for (const k of banCache.keys()) {
      if (count++ >= 1000) break;
      banCache.delete(k);
    }
  }
}

export function clearBanCache(userId: string): void {
  banCache.delete(userId);
}

/**
 * Query the Supabase database directly for a user's active ban status.
 * Used by checkBanAsync as the authoritative source of truth.
 */
export async function checkBanFromDB(userId: string): Promise<BanCheckResult> {
  try {
    const ban = await findActiveBan(userId);

    if (!ban) {
      return { isBanned: false };
    }

    // Check if the ban has expired (non-permanent bans only)
    if (ban.duration !== 'permanent') {
      const now = new Date();
      const expiresAt = new Date(ban.expires_at);
      if (now >= expiresAt) {
        // Ban has expired — deactivate in DB
        await updateBan(ban.id, { is_active: false });
        // Remove from cache as well
        banCache.delete(userId);
        return { isBanned: false };
      }
    }

    // Ban is active — populate cache and return result
    const expiresAtStr = ban.expires_at;
    setBanCache(userId, ban.ban_type, ban.reason, expiresAtStr);

    return {
      isBanned: true,
      banType: ban.ban_type,
      reason: ban.reason,
      expiresAt: expiresAtStr,
    };
  } catch {
    // If DB query fails, don't block the user — return not banned
    // The cache-only path may still catch active bans
    return { isBanned: false };
  }
}

/**
 * SERVER-SIDE ban check — does NOT trust client headers.
 * First checks the in-memory cache (fast path).
 * Falls back to DB query on cache miss for authoritative result.
 *
 * Use this in API routes and async server code where you can await.
 */
export async function checkBanAsync(userId: string): Promise<BanCheckResult> {
  if (!userId) return { isBanned: false };

  // 1. Check server-side cache first (fast path)
  const cached = banCache.get(userId);
  if (cached) {
    const now = new Date();
    const expires = new Date(cached.expiresAt);
    if (cached.banType === 'permanent' || expires > now) {
      return {
        isBanned: true,
        banType: cached.banType,
        reason: cached.reason,
        expiresAt: cached.expiresAt,
      };
    } else {
      // Ban expired, remove from cache
      banCache.delete(userId);
    }
  }

  // 2. Cache miss — query DB for authoritative result
  return checkBanFromDB(userId);
}

/**
 * SYNCHRONOUS server-side ban check — cache-only, no DB fallback.
 * Use this ONLY in middleware/proxy contexts where async is not possible.
 * For all API routes, prefer checkBanAsync() instead.
 */
export function checkBanFromHeaders(_request: NextRequest, userId: string | null): BanCheckResult {
  if (!userId) return { isBanned: false };

  // Check server-side cache only (sync — no DB access)
  const cached = banCache.get(userId);
  if (cached) {
    const now = new Date();
    const expires = new Date(cached.expiresAt);
    if (cached.banType === 'permanent' || expires > now) {
      return {
        isBanned: true,
        banType: cached.banType,
        reason: cached.reason,
        expiresAt: cached.expiresAt,
      };
    } else {
      // Ban expired, remove from cache
      banCache.delete(userId);
    }
  }

  return { isBanned: false };
}

/**
 * Check if a ban type allows a specific action.
 * Ban types: 'login' | 'post' | 'edit' | 'message' | 'full'
 */
export function isActionAllowed(banType: string, action: 'read' | 'post' | 'edit' | 'login' | 'message'): boolean {
  if (action === 'read') return true;
  const blockingBans = BAN_ACTION_MAP[action] || [];
  return !blockingBans.includes(banType as BanType);
}
