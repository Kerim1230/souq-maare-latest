/**
 * Global API route wrapper — `withRoute()`.
 *
 * Combines:
 *  1. Request tracing (traceId, response-time headers)
 *  2. Automatic error catching (no unhandled exceptions ever reach Next.js)
 *  3. Structured logging (request start/end, error with stack traces)
 *  4. Error tracking (via error-tracker for dashboard visibility)
 *  5. Error code classification (automatic fallback codes)
 *  6. Sensitive data filtering (stack traces never exposed to clients)
 *
 * Usage:
 *   import { withRoute } from '@/server/lib/route-wrapper';
 *   export const GET = withRoute(async (request) => { ... });
 *   export const POST = withRoute(async (request) => { ... });
 */

import type { NextRequest } from 'next/server';
import { requestContextStorage } from '@/lib/logger';
import type { RequestContext } from '@/lib/logger';
import { logger } from '@/lib/logger';
import { trackError } from '@/lib/error-tracker';
import { extractTraceId, extractClientIp } from '@/lib/request-tracer';
import { apiError } from '@/lib/api-response';
import { statusCodeToCode } from './error-codes';

// ── Types ───────────────────────────────────────────────────────────────────

type RouteHandler = (_request: NextRequest, ..._args: unknown[]) => Promise<Response>;

interface RouteOptions {
  /** Optional route name for logging (auto-detected from path if not provided) */
  name?: string;
}

// ── Sensitive Data Filter ───────────────────────────────────────────────────

const SENSITIVE_PATTERNS = [
  /SQLSTATE/i, /column.*does not exist/i,
  /relation.*does not exist/i, /duplicate key/i,
  /ECONNREFUSED/i, /ECONNRESET/i, /ENOTFOUND/i,
  /at\s+\S+\s+\(.*\)/,
  /node_modules/i,
];

/**
 * Sanitize an error message for client-facing responses.
 * Internal details (stack traces, SQL, file paths) are never exposed.
 */
function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (SENSITIVE_PATTERNS.some(r => r.test(msg))) {
      return 'حدث خطأ داخلي في الخادم';
    }
    return msg;
  }
  return String(error);
}

// ── Route Wrapper ───────────────────────────────────────────────────────────

/**
 * Higher-order function that wraps an API route handler with full observability.
 *
 * Guarantees:
 * - Every request gets a traceId (X-Request-Id header)
 * - Every request is logged (start + end with duration)
 * - Every error is caught, logged with stack trace, and tracked
 * - No unhandled exceptions reach Next.js (always returns a valid JSON response)
 * - Sensitive data is never exposed in client responses
 */
export function withRoute<T extends RouteHandler>(
  handler: T,
  options?: RouteOptions
): T {
  return (async (request: NextRequest, ...args: unknown[]) => {
    const traceId = extractTraceId(request);
    const url = new URL(request.url);
    const routeName = options?.name || url.pathname;

    // Build request context for AsyncLocalStorage
    const ctx: RequestContext = {
      traceId,
      method: request.method,
      path: url.pathname,
      ip: extractClientIp(request),
      startTime: performance.now(),
      queryCount: 0,
      extra: {},
    };

    // Log request start
    logger.info(`→ ${request.method} ${routeName}`, undefined, {
      traceId,
      method: request.method,
      path: url.pathname,
      ip: ctx.ip,
    });

    try {
      // Execute handler within request context
      const result = await requestContextStorage.run(ctx, () =>
        handler(request, ...args)
      );

      // Add observability headers to response
      if (result instanceof Response) {
        const newHeaders = new Headers(result.headers);
        newHeaders.set('X-Request-Id', traceId);

        const durationMs = Math.round((performance.now() - ctx.startTime) * 100) / 100;
        newHeaders.set('X-Response-Time', String(durationMs));
        newHeaders.set('X-Query-Count', String(ctx.queryCount));

        // Log request completion
        const status = result.status;
        const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

        logger[logLevel](
          `← ${request.method} ${routeName} → ${status}`,
          undefined,
          {
            traceId,
            status,
            durationMs,
            queryCount: ctx.queryCount,
          }
        );

        // Track 5xx errors even if they were caught inside the handler
        if (status >= 500) {
          trackError(
            new Error(`HTTP ${status} from ${routeName}`),
            {
              endpoint: routeName,
              method: request.method,
              statusCode: status,
            }
          );
        }

        return new Response(result.body, {
          status: result.status,
          statusText: result.statusText,
          headers: newHeaders,
        });
      }

      return result;
    } catch (error) {
      // ── GLOBAL ERROR CATCH — this is the safety net ──
      // Errors that escape route-level try/catch end up here.
      // NO error will ever cause an unhandled exception response.

      const durationMs = Math.round((performance.now() - ctx.startTime) * 100) / 100;
      const err = error instanceof Error ? error : new Error(String(error));
      const status = classifyHttpStatus(error);
      const clientMessage = status >= 500
        ? 'حدث خطأ غير متوقع في الخادم'
        : sanitizeErrorMessage(error);

      // Structured error logging with full stack trace (server-side only)
      logger.error(
        `✕ ${request.method} ${routeName} → UNHANDLED ${status}`,
        undefined,
        {
          traceId,
          status,
          durationMs,
          queryCount: ctx.queryCount,
          errorName: err.name,
          errorMessage: err.message,
          stack: err.stack?.split('\n').slice(1, 8).join('\n'),
        }
      );

      // Track the error for dashboard visibility
      trackError(error, {
        endpoint: routeName,
        method: request.method,
        statusCode: status,
        userId: ctx.userId,
      });

      // Return a properly formatted error response (never expose internals)
      const errorResponse = apiError(clientMessage, status, {
        code: statusCodeToCode(status),
        requestId: traceId,
      });

      // Inject observability headers
      const newHeaders = new Headers(errorResponse.headers);
      newHeaders.set('X-Request-Id', traceId);
      newHeaders.set('X-Response-Time', String(durationMs));

      return new Response(errorResponse.body, {
        status: errorResponse.status,
        headers: newHeaders,
      });
    }
  }) as T;
}

// ── HTTP Status Classification ─────────────────────────────────────────────

function classifyHttpStatus(error: unknown): number {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Timeout errors → 504
    if (name.includes('timeout') || msg.includes('timeout') || msg.includes('timed out')) {
      return 504;
    }

    // Network errors → 502
    if (
      name.includes('network') || msg.includes('network') ||
      msg.includes('econnrefused') || msg.includes('econnreset') ||
      msg.includes('enotfound') || msg.includes('fetch failed')
    ) {
      return 502;
    }

    // Validation errors → 400
    if (
      msg.includes('validation') || msg.includes('invalid') ||
      msg.includes('required') || msg.includes('must be') ||
      name.includes('zoderror') || name.includes('validationerror')
    ) {
      return 400;
    }

    // JSON parse errors → 400
    if (msg.includes('unexpected token') || msg.includes('json')) {
      return 400;
    }

    // Auth errors → 401
    if (
      msg.includes('unauthorized') || msg.includes('not authenticated') ||
      msg.includes('jwt') || msg.includes('token')
    ) {
      return 401;
    }
  }

  // Default to 500 for unknown errors
  return 500;
}

// ── Convenience Exports ─────────────────────────────────────────────────────

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
