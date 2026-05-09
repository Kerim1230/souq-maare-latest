/**
 * Error tracking system.
 * Classifies errors by type, tracks error rates per endpoint (sliding window),
 * stores last 100 errors in memory, and provides alert thresholds.
 */

import { getTraceId } from '@/lib/request-tracer';

// ── Types ───────────────────────────────────────────────────────────────────

export type ErrorCategory =
  | 'CLIENT_4xx'
  | 'SERVER_5xx'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNKNOWN';

interface TrackedError {
  id: string;
  timestamp: number;
  category: ErrorCategory;
  message: string;
  endpoint?: string;
  method?: string;
  traceId?: string;
  userId?: string;
  statusCode?: number;
  errorName: string;
  stack?: string;
  metadata: Record<string, unknown>;
}

interface EndpointStats {
  endpoint: string;
  total: number;
  errors: number;
  lastErrorAt: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_STORED_ERRORS = 100;
const SLIDING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const ALERT_THRESHOLD = 0.1; // 10% error rate

// ── State ───────────────────────────────────────────────────────────────────

const errorStore: TrackedError[] = [];
const endpointCounts = new Map<string, { total: number; errors: number; timestamps: number[] }>();
let totalTracked = 0;

// Cleanup stale entries periodically
let _lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60 * 1000;

function cleanup(): void {
  const now = Date.now();
  if (now - _lastCleanup < CLEANUP_INTERVAL) return;
  _lastCleanup = now;

  const cutoff = now - SLIDING_WINDOW_MS;

  for (const [endpoint, counts] of endpointCounts) {
    counts.timestamps = counts.timestamps.filter((t) => t > cutoff);
    counts.errors = counts.timestamps.length;
    if (counts.errors === 0 && counts.total > 0) {
      // Reset total but keep it decaying
      counts.total = Math.max(0, counts.total - 10);
    }
    if (counts.total === 0 && counts.errors === 0) {
      endpointCounts.delete(endpoint);
    }
  }
}

// ── Classification ──────────────────────────────────────────────────────────

function classifyError(error: unknown, statusCode?: number): ErrorCategory {
  if (statusCode) {
    if (statusCode >= 400 && statusCode < 500) return 'CLIENT_4xx';
    if (statusCode >= 500) return 'SERVER_5xx';
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name.includes('timeout') || msg.includes('timeout') || msg.includes('timed out')) {
      return 'TIMEOUT';
    }
    if (
      name.includes('network') ||
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('enotfound') ||
      msg.includes('fetch failed')
    ) {
      return 'NETWORK';
    }
    if (
      msg.includes('validation') ||
      msg.includes('invalid') ||
      msg.includes('required') ||
      msg.includes('must be') ||
      name.includes('zoderror') ||
      name.includes('validationerror')
    ) {
      return 'VALIDATION';
    }
  }

  if (statusCode && statusCode >= 500) return 'SERVER_5xx';
  if (statusCode && statusCode >= 400) return 'CLIENT_4xx';

  return 'UNKNOWN';
}

// ── Core Functions ──────────────────────────────────────────────────────────

/**
 * Track an error with full context.
 */
export function trackError(
  error: unknown,
  context?: {
    endpoint?: string;
    method?: string;
    userId?: string;
    statusCode?: number;
    metadata?: Record<string, unknown>;
  }
): TrackedError {
  cleanup();

  const err = error instanceof Error ? error : new Error(String(error));
  const category = classifyError(error, context?.statusCode);
  const traceId = getTraceId();
  const now = Date.now();

  const tracked: TrackedError = {
    id: `err_${now}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now,
    category,
    message: err.message,
    endpoint: context?.endpoint,
    method: context?.method,
    traceId: traceId || undefined,
    userId: context?.userId,
    statusCode: context?.statusCode,
    errorName: err.name,
    stack: err.stack?.split('\n').slice(1, 5).join('\n'),
    metadata: context?.metadata || {},
  };

  // Store in memory buffer
  errorStore.push(tracked);
  if (errorStore.length > MAX_STORED_ERRORS) {
    errorStore.splice(0, errorStore.length - MAX_STORED_ERRORS);
  }

  // Track per-endpoint
  if (context?.endpoint) {
    const existing = endpointCounts.get(context.endpoint);
    if (existing) {
      existing.total++;
      existing.errors++;
      existing.timestamps.push(now);
    } else {
      endpointCounts.set(context.endpoint, {
        total: 1,
        errors: 1,
        timestamps: [now],
      });
    }
  }

  totalTracked++;

  return tracked;
}

/**
 * Get error statistics summary.
 */
export function getErrorStats(): {
  totalTracked: number;
  recentErrors: number;
  errorRate: number;
  byCategory: Record<ErrorCategory, number>;
  alerting: boolean;
  alertingEndpoints: string[];
} {
  cleanup();

  const now = Date.now();
  const cutoff = now - SLIDING_WINDOW_MS;

  // Count recent errors in the sliding window
  const recentErrors = errorStore.filter((e) => e.timestamp > cutoff).length;

  // Total requests in the window (sum all endpoint totals)
  let totalRequests = 0;
  let totalErrors = 0;
  const alertingEndpoints: string[] = [];

  for (const [endpoint, counts] of endpointCounts) {
    totalRequests += counts.total;
    totalErrors += counts.errors;

    if (counts.total > 0 && counts.errors / counts.total > ALERT_THRESHOLD) {
      alertingEndpoints.push(endpoint);
    }
  }

  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

  // By category breakdown (all stored errors)
  const byCategory = {} as Record<ErrorCategory, number>;
  for (const err of errorStore) {
    byCategory[err.category] = (byCategory[err.category] || 0) + 1;
  }

  return {
    totalTracked,
    recentErrors,
    errorRate: Math.round(errorRate * 1000) / 1000,
    byCategory,
    alerting: alertingEndpoints.length > 0,
    alertingEndpoints,
  };
}

/**
 * Get recent errors from the store.
 */
export function getRecentErrors(count = 50): TrackedError[] {
  return errorStore.slice(-count).reverse();
}

/**
 * Get endpoint-level stats.
 */
export function getEndpointStats(): EndpointStats[] {
  cleanup();

  const stats: EndpointStats[] = [];
  for (const [endpoint, counts] of endpointCounts) {
    stats.push({
      endpoint,
      total: counts.total,
      errors: counts.errors,
      lastErrorAt: counts.timestamps[counts.timestamps.length - 1] || 0,
    });
  }

  return stats.sort((a, b) => b.errors - a.errors);
}

/**
 * Reset all tracked data (useful for testing).
 */
export function resetTracker(): void {
  errorStore.length = 0;
  endpointCounts.clear();
  totalTracked = 0;
}

export type { TrackedError, EndpointStats };
