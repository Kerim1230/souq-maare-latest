import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { rateLimited } from '@/lib/api-response';

type RateLimitCategory = keyof typeof LIMITS;

interface RateGuardOptions {
  /** Rate limit category (default: 'general') */
  category?: RateLimitCategory;
  /** Custom key prefix (default: auto-derived from route) */
  keyPrefix?: string;
}

/**
 * Check rate limit and return 429 response if exceeded.
 * Usage in API routes:
 *   const rl = checkRateGuard(request, { category: 'auth' });
 *   if (rl) return rl;
 */
export function checkRateGuard(
  request: NextRequest,
  options?: RateGuardOptions
): NextResponse | null {
  const ip = getClientIp(request);
  const category = options?.category || 'general';
  const prefix = options?.keyPrefix || category;
  const result = checkRateLimit(`${prefix}:${ip}`, LIMITS[category]);

  if (!result.success) {
    const res = rateLimited('طلبات كثيرة جدًا. حاول لاحقًا');
    // Append rate limit headers
    const headers = new Headers(res.headers);
    headers.set('Retry-After', String(Math.ceil((result.resetAt - Date.now()) / 1000)));
    headers.set('X-RateLimit-Remaining', '0');
    return new NextResponse(res.body, {
      status: res.status,
      headers,
    });
  }

  return null; // Not rate limited
}
