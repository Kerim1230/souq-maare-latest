/**
 * Performance monitoring for detecting slow API responses and heavy renders.
 * Runs on the server side only. Logs warnings when thresholds are exceeded.
 *
 * Usage in API routes:
 *   import { perfTimer } from '@/lib/perf-monitor';
 *   const timer = perfTimer('/api/stores');
 *   // ... do work ...
 *   timer.end(); // auto-warns if > 2000ms
 */

import { logger } from '@/lib/logger';

// ── Thresholds ──
const SLOW_API_MS = 2000;        // Warn if API takes > 2s
const CRITICAL_API_MS = 5000;    // Critical if > 5s

// ── In-memory stats ──
interface ApiStats {
  count: number;
  totalTime: number;
  maxTime: number;
  slowCount: number;
}

const stats = new Map<string, ApiStats>();
const MAX_STATS_ENTRIES = 50;

// Memory usage tracking
let lastMemoryWarning = 0;
const MEMORY_WARNING_INTERVAL = 30000; // Warn every 30s
const MEMORY_THRESHOLD_MB = 80; // 80% of 1GB limit

// ── PerfTimer class ──

export class PerfTimer {
  readonly endpoint: string;
  private startTime: number;
  private _ended = false;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.startTime = performance.now();
  }

  /**
   * End timing and log warning if slow.
   * Returns the elapsed time in milliseconds.
   */
  end(): number {
    if (this._ended) return 0;
    this._ended = true;

    const elapsed = performance.now() - this.startTime;
    this.record(elapsed);

    if (elapsed > CRITICAL_API_MS) {
      logger.error(`CRITICAL: ${this.endpoint} took ${Math.round(elapsed)}ms`, 'PerfMonitor');
    } else if (elapsed > SLOW_API_MS) {
      logger.warn(`SLOW: ${this.endpoint} took ${Math.round(elapsed)}ms`, 'PerfMonitor');
    }

    return elapsed;
  }

  private record(elapsed: number): void {
    const existing = stats.get(this.endpoint);
    if (existing) {
      existing.count++;
      existing.totalTime += elapsed;
      existing.maxTime = Math.max(existing.maxTime, elapsed);
      if (elapsed > SLOW_API_MS) existing.slowCount++;
    } else {
      // Prevent unbounded growth
      if (stats.size >= MAX_STATS_ENTRIES) {
        const firstKey = stats.keys().next().value;
        if (firstKey) stats.delete(firstKey);
      }
      stats.set(this.endpoint, {
        count: 1,
        totalTime: elapsed,
        maxTime: elapsed,
        slowCount: elapsed > SLOW_API_MS ? 1 : 0,
      });
    }
  }
}

// ── Convenience function ──

/**
 * Start a performance timer for an API endpoint.
 * Call .end() when the operation completes.
 */
export function perfTimer(endpoint: string): PerfTimer {
  return new PerfTimer(endpoint);
}


// ── Memory monitoring ──

/**
 * Check memory usage and log warning if high.
 * Only warns once per interval to avoid log spam.
 */
export function checkMemory(): { usedMB: number; totalMB: number; percent: number } | null {
  if (typeof process === 'undefined' || !process.memoryUsage) return null;

  const now = Date.now();
  if (now - lastMemoryWarning < MEMORY_WARNING_INTERVAL) return null;

  const mem = process.memoryUsage();
  const usedMB = Math.round(mem.rss / (1024 * 1024));
  const heapMB = Math.round(mem.heapUsed / (1024 * 1024));
  const heapTotalMB = Math.round(mem.heapTotal / (1024 * 1024));
  const percent = Math.round((heapMB / heapTotalMB) * 100);

  if (percent > MEMORY_THRESHOLD_MB) {
    lastMemoryWarning = now;
    logger.warn(
      `HIGH MEMORY: heap ${heapMB}/${heapTotalMB}MB (${percent}%), rss ${usedMB}MB`,
      'PerfMonitor'
    );
  }

  return { usedMB, totalMB: heapTotalMB, percent };
}

// ── Stats dashboard ──

/**
 * Get performance statistics for all tracked endpoints.
 */
export function getPerfStats(): Array<{
  endpoint: string;
  count: number;
  avgMs: number;
  maxMs: number;
  slowRate: number;
}> {
  const result: Array<{
    endpoint: string;
    count: number;
    avgMs: number;
    maxMs: number;
    slowRate: number;
  }> = [];

  for (const [endpoint, s] of stats) {
    result.push({
      endpoint,
      count: s.count,
      avgMs: Math.round(s.totalTime / s.count),
      maxMs: Math.round(s.maxTime),
      slowRate: Math.round((s.slowCount / s.count) * 100),
    });
  }

  return result.sort((a, b) => b.avgMs - a.avgMs);
}


