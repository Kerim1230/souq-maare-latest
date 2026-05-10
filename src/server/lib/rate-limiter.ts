/**
 * Server-side rate limiter for API routes.
 * Uses in-memory sliding window — suitable for single-instance deployment.
 * For multi-instance, use Redis or similar.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
let _lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - _lastCleanup < CLEANUP_INTERVAL) return;
  _lastCleanup = now;
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}

export interface RateLimitConfig {
  /** Time window in seconds (default: 60) */
  windowSeconds?: number;
  /** Max requests in window (default: 10) */
  maxRequests?: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (usually IP or userId).
 * Returns true if the request is allowed, false if rate limited.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = {}
): RateLimitResult {
  cleanup();

  const {
    windowSeconds = 60,
    maxRequests = 10,
  } = config;

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const resetAt = now + windowMs;

  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Get client IP from NextRequest.
 * Checks X-Forwarded-For, X-Real-IP, then falls back to remoteAddress.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  // Fallback: use session cookie hash for differentiation
  const cookieHeader = request.headers.get('cookie');
  const sessionMatch = cookieHeader?.match(/suq_shamel_sid=([^;]+)/);
  return sessionMatch ? `sid:${sessionMatch[1].slice(0, 16)}` : 'unknown';
}

/**
 * Get a summary of the current rate limit store for diagnostics.
 */
export function getRateLimitSummary(): { activeKeys: number; topConsumers: Array<{ key: string; count: number }> } {
  const entries = Array.from(store.entries()).map(([key, entry]) => ({
    key: key.replace(/:\d+\.\d+\.\d+\.\d+$/, ':*'), // Mask IP addresses
    count: entry.count,
  }));

  // Aggregate by prefix
  const aggregated = new Map<string, number>();
  for (const e of entries) {
    aggregated.set(e.key, (aggregated.get(e.key) || 0) + e.count);
  }

  const topConsumers = Array.from(aggregated.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    activeKeys: store.size,
    topConsumers,
  };
}

// Pre-configured limiters for common use cases
export const LIMITS = {
  /** Auth routes (login): 5 requests per 60 seconds per IP */
  auth: { windowSeconds: 60, maxRequests: 5 },
  /** Signup: 3 requests per 60 seconds per IP */
  signup: { windowSeconds: 60, maxRequests: 3 },
  /** Chat send: 20 requests per 60 seconds per user */
  chat: { windowSeconds: 60, maxRequests: 20 },
  /** Comments: 10 requests per 60 seconds per user */
  comment: { windowSeconds: 60, maxRequests: 10 },
  /** Points: 10 requests per 60 seconds */
  points: { windowSeconds: 60, maxRequests: 10 },
  /** Notifications: 20 requests per 60 seconds */
  notifications: { windowSeconds: 60, maxRequests: 20 },
  /** General API: 60 requests per 60 seconds */
  general: { windowSeconds: 60, maxRequests: 60 },
  /** Admin actions: 30 requests per 60 seconds per IP (read-only queries) */
  admin: { windowSeconds: 60, maxRequests: 30 },
  /** Admin mutations: 20 requests per 60 seconds per admin */
  adminMutation: { windowSeconds: 60, maxRequests: 20 },
  /** Uploads: 10 requests per 60 seconds */
  upload: { windowSeconds: 60, maxRequests: 10 },
  /** Mutations (create/update/delete): 30 requests per 60 seconds */
  mutation: { windowSeconds: 60, maxRequests: 30 },
  /** Search/list queries: 60 requests per 60 seconds */
  search: { windowSeconds: 60, maxRequests: 60 },
  /** Favorites operations: 20 requests per 60 seconds */
  favorite: { windowSeconds: 60, maxRequests: 20 },
  /** Order operations: 15 requests per 60 seconds */
  order: { windowSeconds: 60, maxRequests: 15 },
  /** Report creation: 5 requests per 60 seconds per user */
  report: { windowSeconds: 60, maxRequests: 5 },
} as const;
