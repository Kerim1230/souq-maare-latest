import { NextResponse } from 'next/server';
import { getTraceId } from '@/lib/request-tracer';
import type { ErrorCode } from '@/server/lib/error-codes';
import { statusCodeToCode } from '@/server/lib/error-codes';

// ── Unified API Response Contract ──────────────────────────────────────────
// Every API route MUST return one of these shapes:
//   Success: { success: true, data: <payload> }
//   Error:   { success: false, error: <message>, code?: <ErrorCode>, requestId?: <string> }
// No direct NextResponse.json() calls are allowed outside this module.
// ────────────────────────────────────────────────────────────────────────────

// ── Success Helpers ──

/** 200 OK — success with data payload */
export function success(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

/** 201 Created — resource created successfully */
export function created(data: unknown) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

/** @deprecated Use success() instead — kept for backward compatibility */
export const ok = success;

// ── Error Helpers ──

/**
 * Build the error body with traceId and code automatically injected.
 */
function buildErrorBody(
  message: string,
  status: number,
  code?: ErrorCode,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const traceId = getTraceId();
  const body: Record<string, unknown> = {
    success: false,
    error: message,
    code: code || statusCodeToCode(status),
  };
  if (traceId) body.requestId = traceId;
  if (extra) Object.assign(body, extra);
  return body;
}

/** Generic error response with custom status code */
export function apiError(message: string, status: number, extra?: Record<string, unknown> & { code?: ErrorCode }) {
  const { code, ...rest } = extra || {};
  const body = buildErrorBody(message, status, code, rest);
  return NextResponse.json(body, { status });
}

/** 400 Bad Request — missing/invalid parameters */
export function badRequest(message: string, code?: ErrorCode) {
  return apiError(message, 400, { code: code || 'VALID_MISSING_PARAMS' as ErrorCode });
}

/** 401 Unauthorized — not logged in */
export function unauthorized(message = 'غير مصرح به. سجّل الدخول أولاً', code?: ErrorCode) {
  return apiError(message, 401, { code: code || 'AUTH_REQUIRED' as ErrorCode });
}

/** 403 Forbidden — insufficient permissions */
export function forbidden(message = 'ليس لديك صلاحية لهذا الإجراء', code?: ErrorCode) {
  return apiError(message, 403, { code: code || 'FORBIDDEN_INSUFFICIENT_ROLE' as ErrorCode });
}

/** 404 Not Found — resource does not exist */
export function notFound(message = 'المورد غير موجود', code?: ErrorCode) {
  return apiError(message, 404, { code: code || 'NOT_FOUND_PRODUCT' as ErrorCode });
}

/** 409 Conflict — duplicate resource */
export function conflict(message: string, code?: ErrorCode) {
  return apiError(message, 409, { code: code || 'CONFLICT_DUPLICATE' as ErrorCode });
}

/** 429 Too Many Requests — rate limited */
export function rateLimited(message = 'طلبات كثيرة جداً. حاول لاحقاً', code?: ErrorCode) {
  return apiError(message, 429, { code: code || 'RATE_LIMITED' as ErrorCode });
}

/** 500 Internal Server Error */
export function serverError(message = 'حدث خطأ غير متوقع في الخادم', code?: ErrorCode) {
  return apiError(message, 500, { code: code || 'INTERNAL_ERROR' as ErrorCode });
}

/** Convenience alias for generic errors (matches user-requested API) */
export { apiError as error };

// ── Cookie Helpers ──

/**
 * Copy cookies from a source response (e.g., scratch response used for token refresh)
 * to a target response, preserving all Set-Cookie headers.
 */
export function copyCookies(source: NextResponse, target: NextResponse): void {
  const cookies = source.cookies.getAll();
  for (const cookie of cookies) {
    target.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly ?? undefined,
      secure: cookie.secure ?? undefined,
      sameSite: cookie.sameSite as 'lax' | 'strict' | 'none' | undefined,
      path: cookie.path ?? undefined,
      maxAge: cookie.maxAge ?? undefined,
      domain: cookie.domain ?? undefined,
    });
  }
}
