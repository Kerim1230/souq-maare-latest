/**
 * Unified API Client — fetchApi
 *
 * Wraps native fetch to auto-handle the unified API response contract:
 *   Success: { success: true, data: <payload> }
 *   Error:   { success: false, error: <message> }
 *
 * Automatically includes CSRF token header on mutating requests (POST/PUT/DELETE/PATCH)
 * by reading the `suq_maraa_csrf` cookie set by the server middleware.
 *
 * Usage:
 *   const { data, error } = await fetchApi('/api/products');
 *   if (error) { // handle error }
 *   // data is already unwrapped: { products: [...] }
 */

export interface FetchApiResult<T = any> {
  /** Unwrapped data payload (null on error) */
  data: T | null;
  /** Error message (undefined on success) */
  error: string | undefined;
  /** HTTP status code */
  status: number;
  /** Whether the API returned success: true */
  ok: boolean;
}

/** CSRF cookie name — must match the server-side constant */
const CSRF_COOKIE = 'suq_maraa_csrf';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Read a cookie value by name from document.cookie.
 */
function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

/**
 * Check if the HTTP method is a mutating request that requires CSRF.
 */
function isMutatingMethod(method?: string): boolean {
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes((method || '').toUpperCase());
}

/**
 * Build headers object with CSRF token for mutating requests.
 */
function buildHeaders(
  existingHeaders: Record<string, string> | undefined,
  method: string | undefined,
  hasBody: boolean,
): Record<string, string> | undefined {
  const headers: Record<string, string> = { ...existingHeaders };

  if (hasBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Auto-include CSRF token on mutating requests
  if (isMutatingMethod(method)) {
    const csrfToken = getCookieValue(CSRF_COOKIE);
    if (csrfToken) {
      headers[CSRF_HEADER] = csrfToken;
    }
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

/**
 * Refresh the CSRF cookie by making a lightweight GET request.
 * First clears the old cookie to force the server to issue a fresh token.
 * The server proxy sets the `suq_maraa_csrf` cookie on any response
 * when the cookie is missing or too short.
 */
async function refreshCsrfCookie(): Promise<void> {
  try {
    // Clear the old CSRF cookie first so the proxy issues a fresh one
    document.cookie = `${CSRF_COOKIE}=; path=/; max-age=0`;
    await fetch('/api/auth', { method: 'GET', credentials: 'include' });
  } catch {
    // Non-critical: cookie refresh failed
  }
}

/**
 * Ensure the CSRF cookie is available before making mutating requests.
 * If no CSRF cookie exists, refresh it first, then poll until the cookie
 * appears in document.cookie (max 3 seconds, checking every 200ms).
 * Call this before critical operations like image upload or store creation.
 */
export async function ensureCsrfReady(): Promise<void> {
  const existing = getCookieValue(CSRF_COOKIE);
  if (existing && existing.length >= 32) return;

  await refreshCsrfCookie();

  // Poll until the CSRF cookie appears (max 3 seconds)
  const MAX_WAIT = 3000;
  const INTERVAL = 200;
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT) {
    await new Promise(resolve => setTimeout(resolve, INTERVAL));
    const cookie = getCookieValue(CSRF_COOKIE);
    if (cookie && cookie.length >= 32) return;
  }
  // Cookie still not available after timeout — proceed anyway;
  // the auto-retry in fetchApi will handle CSRF_INVALID if needed.
}

/**
 * Make an API request with automatic response unwrapping.
 *
 * - On success (2xx + success: true): returns { data: <payload>, ok: true, ... }
 * - On API error (success: false): returns { data: null, error: <msg>, ok: false, ... }
 * - On HTTP error (non-2xx without JSON body): returns { data: null, error: 'Network error', ok: false, ... }
 * - On network failure: returns { data: null, error: <message>, ok: false, ... }
 *
 * Automatically retries once on CSRF errors (403 + CSRF_INVALID) by refreshing
 * the CSRF cookie first.
 */
export async function fetchApi<T = any>(
  url: string,
  options?: RequestInit,
  _isRetry = false
): Promise<FetchApiResult<T>> {
  try {
    const method = options?.method;
    const body = options?.body;
    const hasBody = !!body;

    // Auto-ensure CSRF cookie is ready before mutating requests
    if (isMutatingMethod(method)) {
      await ensureCsrfReady();
    }

    // Merge headers with CSRF token
    const existingHeaders = (options?.headers as Record<string, string>) || undefined;
    const headers = buildHeaders(existingHeaders, method, hasBody);

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: (options?.credentials as RequestCredentials) ?? 'include',
    });

    // Try to parse JSON body
    let json: any;
    try {
      json = await res.json();
    } catch {
      // No JSON body — return HTTP-level error
      return {
        data: null,
        error: res.statusText || `HTTP ${res.status}`,
        status: res.status,
        ok: false,
      };
    }

    // Unified contract: check success field
    if (json.success === true) {
      return {
        data: json.data as T,
        error: undefined,
        status: res.status,
        ok: true,
      };
    }

    // ── CSRF auto-retry ──
    // If the server rejected the request due to an invalid/missing CSRF token,
    // refresh the CSRF cookie and retry the request exactly once.
    if (
      !_isRetry &&
      res.status === 403 &&
      (json.code === 'CSRF_INVALID' || json.code === 'CSRF_ORIGIN_INVALID' ||
       (typeof json.error === 'string' && json.error.includes('CSRF')))
    ) {
      await refreshCsrfCookie();
      return fetchApi<T>(url, options, true);
    }

    // API returned success: false or missing success field
    return {
      data: null,
      error: json.error || res.statusText || `HTTP ${res.status}`,
      status: res.status,
      ok: false,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'تعذر الاتصال. تحقق من اتصالك بالإنترنت.',
      status: 0,
      ok: false,
    };
  }
}

/**
 * Convenience: GET request with auto-unwrapping.
 */
export async function apiGet<T = any>(url: string, options?: RequestInit): Promise<FetchApiResult<T>> {
  return fetchApi<T>(url, { method: 'GET', ...options });
}

/**
 * Convenience: POST request with JSON body and auto-unwrapping.
 * Automatically includes CSRF token header.
 */
export async function apiPost<T = any>(
  url: string,
  body?: unknown,
  options?: RequestInit
): Promise<FetchApiResult<T>> {
  return fetchApi<T>(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
}

/**
 * Convenience: PUT request with JSON body and auto-unwrapping.
 * Automatically includes CSRF token header.
 */
export async function apiPut<T = any>(
  url: string,
  body?: unknown,
  options?: RequestInit
): Promise<FetchApiResult<T>> {
  return fetchApi<T>(url, {
    method: 'PUT',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
}

/**
 * Convenience: DELETE request with auto-unwrapping.
 * Automatically includes CSRF token header.
 */
export async function apiDelete<T = any>(url: string, options?: RequestInit): Promise<FetchApiResult<T>> {
  return fetchApi<T>(url, { method: 'DELETE', ...options });
}
