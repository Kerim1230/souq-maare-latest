import { NextRequest, NextResponse } from 'next/server';

// ── Session Cookie ──

/** Session cookie name */
export const SESSION_COOKIE = 'suq_shamel_sid';

/** Token expiry: 24 hours in seconds */
const TOKEN_EXPIRY = 24 * 60 * 60;

/** Refresh window: 30 days in seconds (max cookie age) */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/** Cookie options for session */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // Secure on Vercel (HTTPS), non-secure locally (HTTP)
  sameSite: 'lax' as const,
  maxAge: SESSION_MAX_AGE,
  path: '/',
};

// ── Secret Management ──

import { SESSION_SECRET } from '@/config/runtime';

/** Get the mandatory session secret. */
function getSecret(): string {
  const secret = process.env.SESSION_SECRET || SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET environment variable is required and must be at least 32 characters. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  return secret;
}

// ── Base64url Helpers (Edge-compatible) ──

/** Base64url-encode a string (Edge-compatible) */
function base64urlEncode(input: string): string {
  const binary = new TextEncoder().encode(input);
  const encoded = btoa(String.fromCharCode(...binary));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64url-decode a string (Edge-compatible) */
function base64urlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ── JWT Types ──

interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

interface VerifyResult {
  userId: string;
  needsRefresh: boolean;
}

// ── JWT Helpers ──

/**
 * Create a signed JWT token containing userId + iat + exp.
 * Uses HMAC-SHA256 via Web Crypto API (Edge runtime compatible).
 *
 * - iat = issued-at (seconds since epoch)
 * - exp = expiry (iat + 24h)
 */
export async function createSessionToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64urlEncode(JSON.stringify({ userId, iat: now, exp: now + TOKEN_EXPIRY }));
  const signingInput = `${header}.${payload}`;

  const secretKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    new TextEncoder().encode(signingInput)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${signingInput}.${sig}`;
}

/**
 * Verify a JWT token and return the userId + refresh status.
 * Uses HMAC-SHA256 via Web Crypto API (Edge runtime compatible).
 *
 * Returns:
 * - `{ userId, needsRefresh: false }` if token is valid and not expired
 * - `{ userId, needsRefresh: true }` if token signature is valid but expired (within 30-day refresh window)
 * - `null` if token is invalid, malformed, or expired beyond refresh window
 */
export async function verifySessionToken(token: string): Promise<VerifyResult | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, sig] = parts;
    const signingInput = `${header}.${payload}`;

    // Reconstruct signature bytes from base64url
    let sigBase64 = sig.replace(/-/g, '+').replace(/_/g, '/');
    while (sigBase64.length % 4) sigBase64 += '=';
    const sigBytes = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));

    const secretKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      sigBytes,
      new TextEncoder().encode(signingInput)
    );

    if (!valid) return null;

    // Decode and validate payload
    const decoded: unknown = JSON.parse(base64urlDecode(payload));
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('userId' in decoded) ||
      typeof (decoded as Record<string, unknown>).userId !== 'string'
    ) {
      return null;
    }

    const jwtPayload = decoded as JwtPayload;
    const now = Math.floor(Date.now() / 1000);

    // Check if token is expired
    const expired = jwtPayload.exp && jwtPayload.exp < now;

    // Check if within refresh window (30 days from iat)
    const iat = jwtPayload.iat || 0;
    const beyondRefreshWindow = now >= iat + SESSION_MAX_AGE;

    if (beyondRefreshWindow) return null;

    return {
      userId: jwtPayload.userId,
      needsRefresh: !!expired,
    };
  } catch {
    return null;
  }
}

// ── Session Cookie (JWT-backed) ──

/**
 * Set the session cookie on a response.
 * Stores a signed JWT with userId, iat, and exp.
 */
export async function setSessionCookie(response: NextResponse, userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  response.cookies.set(SESSION_COOKIE, token, COOKIE_OPTIONS);
}

/**
 * Clear the session cookie from a response.
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE);
}

/**
 * Get the current user ID from request cookies.
 * Verifies the JWT signature and checks expiry.
 * Returns null if not authenticated, token invalid, or expired beyond refresh window.
 *
 * NOTE: This returns the userId even for expired tokens within the 30-day refresh window.
 * Use `getSessionAndRefresh()` to also auto-refresh expired tokens.
 */
export async function getSessionUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // Detect legacy plain-text userId (no dots → not a JWT)
  // Legacy tokens validated against Supabase public.users
  if (!token.includes('.')) {
    try {
      const { findUserById } = await import('@/lib/supabase-db');
      const user = await findUserById(token);
      if (user) return token;
    } catch {
      // Supabase unavailable — cannot validate legacy token
    }
    return null;
  }

  const result = await verifySessionToken(token);
  return result?.userId ?? null;
}

/**
 * Get the current user ID and auto-refresh the session cookie if the token is expired
 * but still within the refresh window.
 *
 * Usage in API routes:
 * ```ts
 * const authResult = await getSessionAndRefresh(request, response);
 * if (!authResult) return unauthorized();
 * // authResult.userId is available, cookie is fresh
 * ```
 */
export async function getSessionAndRefresh(
  request: NextRequest,
  response: NextResponse
): Promise<{ userId: string } | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // Legacy token upgrade — validate against Supabase public.users
  if (!token.includes('.')) {
    try {
      const { findUserById } = await import('@/lib/supabase-db');
      const user = await findUserById(token);
      if (user) {
        await setSessionCookie(response, token);
        return { userId: token };
      }
    } catch {
      // Supabase unavailable
    }
    return null;
  }

  const result = await verifySessionToken(token);
  if (!result) return null;

  // Auto-refresh if token is expired but within window
  if (result.needsRefresh) {
    await setSessionCookie(response, result.userId);
  }

  return { userId: result.userId };
}

/**
 * Create a response with session cookie set.
 */
export async function withSession(data: Record<string, unknown>, userId: string): Promise<NextResponse> {
  const response = NextResponse.json(data);
  await setSessionCookie(response, userId);
  return response;
}
