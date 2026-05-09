import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE = 'suq_maraa_csrf';
const CSRF_HEADER = 'x-csrf-token';

// Generate a random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Cookie options for CSRF token (NOT HttpOnly — JS must read it)
const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production', // Secure on Vercel (HTTPS), non-secure locally (HTTP)
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 24 * 60 * 60, // 24 hours
};

/**
 * Ensure a CSRF cookie exists on the response.
 * Call this on GET requests or any request that renders a page.
 */
export function ensureCsrfCookie(response: NextResponse): void {
  const existingToken = response.cookies.get(CSRF_COOKIE)?.value;
  if (!existingToken || existingToken.length < 32) {
    response.cookies.set(CSRF_COOKIE, generateToken(), CSRF_COOKIE_OPTIONS);
  }
}

/**
 * Validate CSRF token for mutating requests (POST/PUT/DELETE/PATCH).
 * The token must be present in both the cookie AND the x-csrf-token header,
 * and they must match.
 *
 * Returns true if valid, false if invalid.
 */
export function validateCsrf(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) return false;
  if (cookieToken !== headerToken) return false;
  if (cookieToken.length < 32) return false;

  return true;
}

/**
 * Middleware helper: check if the request is a mutating method.
 */
export function isMutatingMethod(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
}

export { CSRF_COOKIE, CSRF_HEADER };
