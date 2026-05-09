/**
 * ⚡ TTL Cache Layer
 *
 * In-memory cache with time-to-live for API responses.
 * Prevents re-fetching data that hasn't changed recently.
 *
 * Usage:
 *   const products = await ttlCache.getOrFetch('products:featured',
 *     () => apiGet('/api/products?isFeatured=true'),
 *     { ttl: 60_000 } // 1 minute
 *   );
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface CacheOptions {
  /** Time-to-live in ms. Default: 30_000 (30 seconds) */
  ttl?: number;
  /** Max entries. Default: 50. Oldest evicted when exceeded. */
  maxSize?: number;
}

const DEFAULT_TTL = 30_000; // 30 seconds
const DEFAULT_MAX_SIZE = 50;

class TTLCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    // Evict oldest if at capacity
    if (this.cache.size >= DEFAULT_MAX_SIZE && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, { data, expiresAt: Date.now() + ttl });
  }

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const ttl = options?.ttl ?? DEFAULT_TTL;
    // maxSize is reserved for future eviction strategy; currently uses DEFAULT_MAX_SIZE

    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    // Fetch fresh data
    const data = await fetchFn();
    this.set(key, data, ttl);
    return data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Invalidate all keys matching a prefix (e.g., 'products:*') */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /** Clear entire cache */
  clear(): void {
    this.cache.clear();
  }

  /** Get cache size */
  get size(): number {
    return this.cache.size;
  }
}

// Singleton
export const ttlCache = new TTLCache();
export default ttlCache;
