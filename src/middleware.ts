import { NextRequest, NextResponse } from 'next/server'
import { CSRF_COOKIE, newCsrfToken } from '@/lib/auth/csrf'

/**
 * Issues the CSRF double-submit cookie used by /api route verification
 * (see src/lib/auth/csrf.ts). The cookie is deliberately NOT httpOnly:
 * same-origin client JavaScript must read it and echo it in the
 * `x-csrf-token` header — that is what makes the pattern work behind
 * proxies that rewrite the Host header. Cross-site attackers cannot read
 * it, and SameSite=Lax prevents it being attached to cross-site posts.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next()
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
  // Privacy: the console renders private per-tenant data and must never be
  // stored by the browser (heuristic HTTP cache or back/forward cache) —
  // a cached console snapshot could otherwise be re-read after logout by
  // the next user of the same profile. Public church pages stay cacheable.
  const path = req.nextUrl.pathname
  if (path === '/console' || path.startsWith('/console/')) {
    res.headers.set('Cache-Control', 'no-store, must-revalidate')
  }
  return res
}

export const config = {
  matcher: [
    // All pages except Next internals and static files.
    '/((?!_next/static|_next/image|favicon.svg|robots.txt|sitemap|api/|og-default).*)',
  ],
}
