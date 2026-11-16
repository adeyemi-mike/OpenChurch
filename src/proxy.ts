import { NextRequest, NextResponse } from 'next/server'
import { CSRF_COOKIE, newCsrfToken } from '@/lib/auth/csrf'
import { resolveChurchByHost, isPlatformHost, canonicalRedirectFor } from '@/lib/tenancy/resolver'

/**
 * Network boundary (Next.js 16 "proxy" — always Node.js runtime, which is
 * what allows direct Prisma access for host→tenant resolution).
 *
 * Responsibilities:
 *
 * 1. CSRF double-submit cookie issuance (unchanged — see lib/auth/csrf.ts).
 * 2. Cache-privacy headers for the console (unchanged).
 * 3. Custom-domain tenant routing:
 *
 *    A request arriving on a church's VERIFIED+ACTIVE custom domain
 *    (e.g. https://www.gracecommunity.org/about) is rewritten to the
 *    internal church route (/church/grace-community/about) so the same
 *    website engine serves it. Rules:
 *
 *      - Only ACTIVE domains resolve (verification is enforced at the
 *        resolver; unverified/removed hostnames never select a tenant).
 *      - Platform-owned hosts (the configured origin, PLATFORM_ROOT_DOMAIN
 *        subdomains, localhost) are never rewritten.
 *      - Platform application paths (/console, /api, /login, …) are never
 *        rewritten even on a church domain.
 *      - /sitemap.xml and /robots.txt on a church domain serve that
 *        church's sitemap/robots.
 *      - Canonical-host enforcement: a request on the church's ACTIVE
 *        NON-PRIMARY domain is 308-redirected to the same path on the
 *        primary domain (how www ↔ apex relationships are handled).
 *      - Unknown hosts pass through to the platform site (no tenant
 *        existence leak).
 *
 * The hostname comes from the Host header; X-Forwarded-Host is only
 * consulted when Host is an internal address (proxy-rewritten topology) —
 * arbitrary forwarded values can never inject a tenant.
 */

/** Paths that belong to the PLATFORM, never to a church website. */
const PLATFORM_PATHS = [
  '/console',
  '/admin',
  '/login',
  '/logout',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
  '/privacy',
  '/terms',
  '/api',
  '/_next',
  '/church',
  '/favicon',
  '/og-default',
  '/icon',
  '/apple',
  '/manifest',
  '/robots.txt',
  '/sitemap.xml',
]

function isPlatformPath(path: string): boolean {
  if (PLATFORM_PATHS.includes(path)) return true
  return PLATFORM_PATHS.some((p) => path.startsWith(`${p}/`) || path === p)
}

function isInternalHostname(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.startsWith('127.') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    h.startsWith('172.') ||
    h.endsWith('.internal') ||
    h.endsWith('.svc') ||
    h.endsWith('.fcapp.run') ||
    !h.includes('.')
  )
}

/** Effective request host — Host first, forwarded host only for internal Hosts. */
function effectiveHost(req: NextRequest): string | null {
  const host = req.headers.get('host')
  if (host && !isInternalHostname(host.split(':')[0])) return host
  const forwarded = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  return host
}

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()

  // --- CSRF double-submit cookie (unchanged) ------------------------------
  const existing = req.cookies.get(CSRF_COOKIE)?.value
  if (!existing) {
    res.cookies.set(CSRF_COOKIE, newCsrfToken(), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    })
  }

  // --- Console cache privacy (unchanged) -----------------------------------
  const path = req.nextUrl.pathname
  if (path === '/console' || path.startsWith('/console/')) {
    res.headers.set('Cache-Control', 'no-store, must-revalidate')
  }

  // --- Custom-domain tenant routing ----------------------------------------
  try {
    const host = effectiveHost(req)
    if (host && !isPlatformHost(host)) {
      const tenant = await resolveChurchByHost(host)
      if (tenant) {
        // Canonical-host enforcement: church content on an ACTIVE
        // non-primary domain redirects (308) to the primary domain — one
        // canonical host per church, www ↔ apex included. Platform
        // application paths are never redirected (they are not church
        // content; the rewrite block below already excludes them).
        if (!isPlatformPath(path)) {
          const redirectTo = canonicalRedirectFor(tenant, path, req.nextUrl.search)
          if (redirectTo) {
            return NextResponse.redirect(redirectTo, 308)
          }
        }
        if (path === '/sitemap.xml') {
          return NextResponse.rewrite(new URL(`/church/${tenant.slug}/sitemap.xml`, req.url))
        }
        if (path === '/robots.txt') {
          return NextResponse.rewrite(new URL(`/church/${tenant.slug}/robots.txt`, req.url))
        }
        if (!isPlatformPath(path)) {
          const suffix = path === '/' ? '' : path
          return NextResponse.rewrite(new URL(`/church/${tenant.slug}${suffix}`, req.url))
        }
      }
    }
  } catch (err) {
    // Tenant resolution must never take the whole site down — on failure the
    // request proceeds as platform traffic.
    console.error('[proxy] host resolution failed', err)
  }

  return res
}

export const config = {
  matcher: [
    // All pages except Next internals and static files. robots.txt/sitemap
    // ARE included (custom-domain rewrites need them); platform requests to
    // them are handled by their normal routes.
    '/((?!_next/static|_next/image|api/|og-default).*)',
  ],
}
