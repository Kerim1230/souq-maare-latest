/**
 * ⚡ Server-Side API Cache Layer
 *
 * Smart caching for Supabase API routes to reduce database queries
 * and Vercel serverless function invocations.
 *
 * Features:
 * - TTL-based cache with per-route customization
 * - Automatic cache key generation from request parameters
 * - Cache hit/miss logging for monitoring
 * - Invalidation helpers for mutations
 * - Memory-safe with automatic eviction
 */

// ── Cache Entry ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  key: string;
}

// ── Configuration ──────────────────────────────────────────────────────

export interface CacheConfig {
  /** Time-to-live in ms. Default: 300_000 (5 minutes) */
  ttl?: number;
  /** Max entries in cache. Default: 200 */
  maxSize?: number;
  /** Whether to log cache hits/misses. Default: true */
  log?: boolean;
}

const DEFAULT_TTL = 300_000; // 5 minutes
const DEFAULT_MAX_SIZE = 200;

// ── Predefined TTLs for common routes ──────────────────────────────────

export const CACHE_TTL = {
  CATEGORIES: 30 * 60 * 1000,  // 30 minutes — categories rarely change
  HOME: 5 * 60 * 1000,         // 5 minutes — home page data
  STORES: 10 * 60 * 1000,      // 10 minutes — store listings
  PRODUCTS: 5 * 60 * 1000,     // 5 minutes — product listings
  SEARCH: 2 * 60 * 1000,       // 2 minutes — search results (volatile)
  AUTH_SESSION: 15 * 60 * 1000, // 15 minutes — auth session
} as const;

// ── Cache Class ────────────────────────────────────────────────────────

class ServerCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private enableLog: boolean;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(config?: CacheConfig) {
    this.maxSize = config?.maxSize ?? DEFAULT_MAX_SIZE;
    this.enableLog = config?.log ?? true;
  }

  /**
   * Get cached data by key. Returns null if not found or expired.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      if (this.enableLog) {
        console.log(`[Cache] ⏰ EXPIRED: ${key}`);
      }
      return null;
    }

    this.stats.hits++;
    if (this.enableLog) {
      const remainingMs = entry.expiresAt - Date.now();
      const remainingSec = Math.round(remainingMs / 1000);
      console.log(`[Cache] ✅ HIT: ${key} (${remainingSec}s remaining)`);
    }
    return entry.data as T;
  }

  /**
   * Store data in cache with optional TTL.
   */
  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
      key,
    });

    if (this.enableLog) {
      const ttlSec = Math.round(ttl / 1000);
      console.log(`[Cache] 💾 SET: ${key} (TTL: ${ttlSec}s)`);
    }
  }

  /**
   * Get from cache, or fetch and cache the result.
   * This is the primary method to use in API routes.
   */
  async cachedQuery<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const data = await fetchFn();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Invalidate a specific cache key.
   */
  invalidate(key: string): void {
    if (this.cache.delete(key) && this.enableLog) {
      console.log(`[Cache] 🗑️ INVALIDATE: ${key}`);
    }
  }

  /**
   * Invalidate all keys matching a prefix.
   * Useful for invalidating all product-related caches after a mutation.
   */
  invalidateByPrefix(prefix: string): void {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0 && this.enableLog) {
      console.log(`[Cache] 🗑️ INVALIDATE PREFIX: ${prefix}* (${count} entries)`);
    }
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    if (this.enableLog) {
      console.log(`[Cache] 🧹 CLEAR: ${size} entries removed`);
    }
  }

  /**
   * Get cache statistics.
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? Math.round((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100)
        : 0,
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }
}

// ── Singleton Instance ─────────────────────────────────────────────────

export const serverCache = new ServerCache();

// ── Helper: Generate cache key from request ────────────────────────────

/**
 * Generate a cache key from a NextRequest object.
 * Uses the pathname + sorted search params for consistent keys.
 */
export function cacheKeyFromRequest(request: Request, prefix?: string): string {
  const url = new URL(request.url);
  const pathname = prefix || url.pathname;

  // Sort params for consistent keys
  const params = new URLSearchParams(url.searchParams);
  const sortedKeys = Array.from(params.keys()).sort();
  const paramParts = sortedKeys.map(k => `${k}=${params.get(k)}`);

  if (paramParts.length === 0) return pathname;
  return `${pathname}?${paramParts.join('&')}`;
}

/**
 * Convenience function: cached query with automatic key generation.
 */
export async function cachedQuery<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number,
): Promise<T> {
  return serverCache.cachedQuery(key, fetchFn, ttl);
}

export default serverCache;
