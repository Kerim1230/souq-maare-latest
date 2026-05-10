import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter'
import {
  CSRF_COOKIE,
  ensureCsrfCookie,
  isMutatingMethod,
  validateCsrf,
} from '@/lib/csrf'
import { SESSION_COOKIE } from '@/lib/session'

/**
 * Generate a 16-character hex request ID.
 * Edge Runtime always provides crypto.getRandomValues.
 */
function generateRequestId(): string {
  const hex = new Uint8Array(8)
  crypto.getRandomValues(hex)
  return Array.from(hex).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Helper: create a JSON error response that works reliably in the Next.js 16 proxy.
 */
function proxyJsonResponse(body: Record<string, unknown>, status: number, extraHeaders?: Record<string, string>): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }
  return new NextResponse(JSON.stringify(body), { status, headers })
}

const ADMIN_ONLY_ROUTES = [
  '/api/admin/',
  '/api/users',
  '/api/auto-delete',
]

const DANGEROUS_ROUTES = [
  '/api/stores/verify',
  '/api/stores/toggle-featured',
  '/api/products/toggle-featured',
]

/**
 * Routes exempt from CSRF validation.
 */
const CSRF_EXEMPT_ROUTES = [
  '/api/auth/signup',
  '/api/auth/signin',
  '/api/webhooks/',
]

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_ROUTES.some(r => pathname.startsWith(r))
}

/**
 * Check if a hostname is a local or private address.
 * Returns true for: localhost, 127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x,
 * ::1, or any hostname ending in .local, .internal, .z.ai (sandbox).
 */
function isLocalOrPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost') return true
  if (hostname === '127.0.0.1' || hostname === '::1') return true
  // Private IP ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) return true
  // Loopback range 127.x.x.x
  if (/^127\./.test(hostname)) return true
  // Common local/dev domains
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true
  // Sandbox domains (e.g. web-xxxxx.z.ai)
  if (hostname.endsWith('.z.ai')) return true
  return false
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()
  const isSharePage = request.method === 'GET' && pathname.startsWith('/share/');

  // ── Request ID Generation ──
  const requestId =
    request.headers.get('x-request-id') ||
    request.headers.get('x-trace-id') ||
    generateRequestId()
  response.headers.set('X-Request-Id', requestId)

  // ── Request Start Time Header ──
  response.headers.set('X-Request-Start', String(Date.now()))

  // ── Security Headers ──
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // ── Service Worker Cache Migration ──
  // Clear SW caches to force loading new JS bundles (resolves hydration mismatch
  // from old app name SW caches). Only on root page. Can be removed after migration.
  if (pathname === '/') {
    response.headers.set('Clear-Site-Data', '"cache"')
  }

  // CORS headers for iframe / preview panel compatibility
  const origin = request.headers.get('origin')
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, x-request-id')
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const optHeaders: Record<string, string> = {}
    response.headers.forEach((v, k) => { optHeaders[k] = v })
    return new NextResponse(null, { status: 204, headers: optHeaders })
  }

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data: https:",
      "connect-src 'self' https: http: wss: ws:",
      "frame-ancestors *",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  )

  // ── CSRF Protection ──
  // Skip CSRF on share pages — they're public static previews that need to be CDN-cacheable

  // 1. Issue CSRF cookie if not present on any request (except share pages)
  const existingCsrf = request.cookies.get(CSRF_COOKIE)?.value
  if (!isSharePage && (!existingCsrf || existingCsrf.length < 32)) {
    ensureCsrfCookie(response)
  }

  // 2. Validate Origin header on mutating requests (CSRF defense-in-depth)
  //    Relaxed for sandbox/proxy/development environments:
  //    - In development mode, Origin mismatch is allowed (CSRF token is primary guard)
  //    - Allow if either side is a local/private address or the request comes through a reverse proxy.
  //    The CSRF token check (step 3) is always the primary guard.
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (isMutatingMethod(request) && !isCsrfExempt(pathname) && !isDevelopment) {
    const host = request.headers.get('host')
    if (origin && host) {
      try {
        const originUrl = new URL(origin)
        const originHost = originUrl.hostname
        const hostName = host.split(':')[0] // strip port

        // Allow if hostnames match (ignoring port differences)
        if (originHost === hostName) {
          // pass
        } else if (isLocalOrPrivateHost(originHost) || isLocalOrPrivateHost(hostName)) {
          // Allow if either side is local/private (sandbox, reverse proxy, dev env)
        } else if (request.headers.get('x-forwarded-for') || request.headers.get('x-forwarded-host')) {
          // Allow if request came through a reverse proxy / gateway
        } else {
          return proxyJsonResponse(
            { error: 'طلب غير صالح: أصل الطلب غير متطابق', code: 'CSRF_ORIGIN_INVALID' },
            403
          )
        }
      } catch {
        // Malformed Origin/Host — allow through (CSRF token check is the primary guard)
      }
    }
  }

  // 3. Validate CSRF token on mutating requests (except exempt routes)
  if (isMutatingMethod(request) && !isCsrfExempt(pathname)) {
    if (!validateCsrf(request)) {
      return proxyJsonResponse(
        { error: 'طلب غير صالح: رمز CSRF غير متطابق أو مفقود', code: 'CSRF_INVALID' },
        403
      )
    }
  }

  // ── Cache headers for share pages (social media crawlers need cacheable responses) ──
  // Skip CSRF cookie on share pages so Vercel CDN can cache them (set-cookie prevents caching)
  if (isSharePage) {
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
  }

  // ── Cache headers for public API GET endpoints ──
  if (request.method === 'GET') {
    const isCacheableApi = pathname.startsWith('/api/products') ||
      pathname.startsWith('/api/stores') ||
      pathname.startsWith('/api/home') ||
      pathname.startsWith('/api/offer/') ||
      pathname.startsWith('/api/my-store/offers') ||
      pathname.startsWith('/api/payment-settings');
    if (isCacheableApi) {
      response.headers.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    }
  }

  // ── Rate Limiting for /api/admin/* ──
  if (pathname.startsWith('/api/admin/')) {
    const clientIp = getClientIp(request)
    const rateLimitResult = checkRateLimit(`admin:${clientIp}`, LIMITS.admin)

    if (!rateLimitResult.success) {
      return proxyJsonResponse(
        { error: 'طلبات كثيرة جدًا، حاول لاحقًا', code: 'RATE_LIMITED' },
        429,
        {
          'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        }
      )
    }

    // Attach rate limit info headers to successful requests
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    response.headers.set('X-RateLimit-Reset', String(rateLimitResult.resetAt))
  }

  // Rate limiting for write endpoints (POST/PUT/DELETE on non-auth routes)
  if (isMutatingMethod(request) && pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
    const clientIp = getClientIp(request)
    const rateLimitResult = checkRateLimit(`write:${clientIp}`, LIMITS.mutation)

    if (!rateLimitResult.success) {
      return proxyJsonResponse(
        { error: 'طلبات تعديل كثيرة. حاول لاحقًا', code: 'RATE_LIMITED' },
        429,
        {
          'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
        }
      )
    }
  }

  // ── Block dangerous admin-only routes ──
  const isDangerous = DANGEROUS_ROUTES.some(r => pathname.startsWith(r))
  const isAdminRoute = ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))

  if (isDangerous || isAdminRoute) {
    // Check for JWT session cookie
    const hasSession = request.cookies.get(SESSION_COOKIE)?.value
    if (!hasSession) {
      if (pathname.startsWith('/api/')) {
        return proxyJsonResponse(
          { error: 'يجب تسجيل الدخول أولاً', code: 'AUTH_REQUIRED' },
          401
        )
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|app-icon.png).*)',
  ],
}
