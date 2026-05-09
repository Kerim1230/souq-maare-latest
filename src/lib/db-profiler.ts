/**
 * ⚠️ STUB FILE — Database Query Profiling
 *
 * All functions return empty/zero data. Supabase queries are not profiled.
 * Kept solely because the diagnostics endpoint (/api/diagnostics) imports from here.
 * If the diagnostics endpoint is removed, this file can be deleted.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ProfiledQuery {
  id: string;
  timestamp: number;
  table?: string;
  operation: string;
  durationMs: number;
  traceId?: string;
  rowCount?: number;
  error?: string;
  pattern: string;
}

export interface QueryStats {
  totalQueries: number;
  avgDurationMs: number;
  slowQueries: number;    // > 500ms
  criticalQueries: number; // > 2s
  topTables: Record<string, number>;
  topOperations: Record<string, number>;
}

// ── Stub Implementation ─────────────────────────────────────────────────────

/**
 * Get slow queries — returns empty array (Supabase queries are not profiled).
 */
export function getSlowQueries(_count = 50, _thresholdMs = 500): ProfiledQuery[] {
  return []
}

/**
 * Get aggregated query statistics — returns zeros.
 */
export function getQueryStats(): QueryStats {
  return {
    totalQueries: 0,
    avgDurationMs: 0,
    slowQueries: 0,
    criticalQueries: 0,
    topTables: {},
    topOperations: {},
  }
}

/**
 * Reset query history — no-op.
 */
export function resetProfiler(): void {
  // No-op: Supabase queries are not tracked by this profiler
}
