/**
 * Request tracing middleware helper.
 * Generates or extracts X-Request-Id, creates an AsyncLocalStorage context
 * for the entire request lifecycle, and provides helpers for trace-aware logging.
 */

import type { NextRequest } from 'next/server';
import type { RequestContext } from '@/lib/logger';
import { requestContextStorage, logger } from '@/lib/logger';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a 16-character hex trace ID.
 */
export function generateTraceId(): string {
  const hex = Buffer.allocUnsafe(8);
  // Use crypto.getRandomValues if available, otherwise Math.random fallback
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(hex);
  } else {
    for (let i = 0; i < 8; i++) {
      hex[i] = Math.floor(Math.random() * 256);
    }
  }
  return hex.toString('hex');
}

/**
 * Extract or generate trace ID from request headers.
 * Checks X-Request-Id, X-Trace-Id, then generates a new one.
 */
export function extractTraceId(request: Request): string {
  return (
    request.headers.get('x-request-id') ||
    request.headers.get('x-trace-id') ||
    generateTraceId()
  );
}

/**
 * Extract client IP from request.
 */
export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/**
 * Get the current trace ID if inside a request context.
 */
export function getTraceId(): string | undefined {
  return requestContextStorage.getStore()?.traceId;
}

/**
 * Get the elapsed time since the request started (in ms).
 * Returns undefined if not in a request context.
 */
export function getSpanDuration(): number | undefined {
  const ctx = requestContextStorage.getStore();
  if (!ctx) return undefined;
  return Math.round((performance.now() - ctx.startTime) * 100) / 100;
}

/**
 * Get the full request context (if inside a request scope).
 */
export function getFullContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Increment the query count for the current request context.
 */
export function incrementQueryCount(): void {
  const ctx = requestContextStorage.getStore();
  if (ctx) ctx.queryCount++;
}

/**
 * Get the current query count for the request.
 */
export function getQueryCount(): number {
  return requestContextStorage.getStore()?.queryCount || 0;
}

// ── Context Creation ────────────────────────────────────────────────────────

/**
 * Build a RequestContext object from an incoming request.
 */
export function buildRequestContext(
  request: NextRequest,
  overrides?: Partial<RequestContext>
): RequestContext {
  const url = new URL(request.url);
  const traceId = extractTraceId(request);

  return {
    traceId,
    method: request.method,
    path: url.pathname,
    ip: extractClientIp(request),
    startTime: performance.now(),
    queryCount: 0,
    extra: {},
    ...overrides,
  };
}

// ── Tracing Wrapper ─────────────────────────────────────────────────────────

type RouteHandler = (_request: NextRequest, ..._args: unknown[]) => Promise<Response>;

/**
 * Higher-order function that wraps an API route handler with tracing.
 * Creates an AsyncLocalStorage context for the request lifecycle,
 * logs the request start/completion, and adds X-Request-Id to the response.
 *
 * Usage:
 *   export const GET = withTracing(async (request) => { ... });
 *   export const POST = withTracing(async (request) => { ... });
 */
export function withTracing<T extends RouteHandler>(handler: T): T {
  return (async (request: NextRequest, ...args: unknown[]) => {
    const traceId = extractTraceId(request);
    const url = new URL(request.url);
    const ctx: RequestContext = {
      traceId,
      method: request.method,
      path: url.pathname,
      ip: extractClientIp(request),
      startTime: performance.now(),
      queryCount: 0,
      extra: {},
    };

    logger.info(`Incoming ${request.method} ${url.pathname}`, undefined, {
      traceId,
      method: request.method,
      path: url.pathname,
      ip: ctx.ip,
    });

    try {
      const result = await requestContextStorage.run(ctx, () =>
        handler(request, ...args)
      );

      // Add trace ID to response headers if possible
      if (result instanceof Response) {
        const newHeaders = new Headers(result.headers);
        newHeaders.set('X-Request-Id', traceId);

        const durationMs = Math.round((performance.now() - ctx.startTime) * 100) / 100;
        newHeaders.set('X-Response-Time', String(durationMs));
        newHeaders.set('X-Query-Count', String(ctx.queryCount));

        const status = result.status;
        const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

        logger[logLevel](
          `${request.method} ${url.pathname} → ${status}`,
          undefined,
          {
            traceId,
            status,
            durationMs,
            queryCount: ctx.queryCount,
          }
        );

        return new Response(result.body, {
          status: result.status,
          statusText: result.statusText,
          headers: newHeaders,
        });
      }

      return result;
    } catch (error) {
      const durationMs = Math.round((performance.now() - ctx.startTime) * 100) / 100;

      logger.error(
        `${request.method} ${url.pathname} → UNHANDLED ERROR`,
        undefined,
        {
          traceId,
          durationMs,
          queryCount: ctx.queryCount,
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      );

      throw error;
    }
  }) as T;
}

/**
 * Run a function inside a request context manually.
 * Useful for background jobs or non-route-handler scenarios.
 */
export function withRequestContext<T>(
  ctx: RequestContext,
  fn: () => T
): T {
  return requestContextStorage.run(ctx, fn);
}
