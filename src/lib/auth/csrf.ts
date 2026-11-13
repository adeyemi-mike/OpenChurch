/**
 * CSRF protection that works behind ANY reverse proxy topology.
 *
 * PROBLEM
 * -------
 * Host-based origin checks (comparing the browser's Origin header with the
 * request Host / X-Forwarded-Host) break when the edge proxy rewrites the
 * Host header to an internal address — exactly what managed/serverless
 * gateways do. In those topologies every legitimate same-origin browser
 * request was rejected ("Cross-site request blocked").
 *
 * SOLUTION — layered verification, evaluated in order:
 *
 *   1. If the Origin host matches Host / X-Forwarded-Host → same-origin,
 *      pass. (Covers direct/self-hosted deployments.)
 *   2. If the Origin host is listed in TRUSTED_ORIGINS (comma-separated
 *      env, for operators who terminate at a known edge) → pass.
 *   3. Double-submit cookie check: the `openchurch_csrf` cookie value must
 *      equal the `x-csrf-token` header. Only same-origin JavaScript can read
 *      the cookie and echo the header; a cross-site attacker can do neither
 *      (cookie is SameSite=Lax and unreadable cross-origin). Pass.
 *   4. Otherwise → reject.
 *
 * Requests without an Origin header (curl, server-to-server) pass the
 * origin layer — CSRF is a browser attack; such clients are still bound by
 * session-cookie theft, which SameSite=Lax mitigates. This matches the
 * previous behaviour and keeps API integrations possible.
 *
 * NOTE: this module must stay Edge-runtime-compatible (it is imported by
 * src/middleware.ts) — no `node:` imports and no `server-only` marker.
 */

export const CSRF_COOKIE = 'openchurch_csrf'
export const CSRF_HEADER = 'x-csrf-token'

/** Pure decision function — unit-tested in tests/csrf.test.ts. */
export function verifyCsrf(input: {
  origin: string | null
  host: string | null
  xForwardedHost: string | null
  trustedOrigins: string[]
  csrfCookie: string | null
  csrfHeader: string | null
}): { ok: boolean; reason?: string } {
  const { origin, host, xForwardedHost, trustedOrigins, csrfCookie, csrfHeader } = input

  if (origin) {
    let originHost: string
    try {
      originHost = new URL(origin).host
    } catch {
      return { ok: false, reason: 'INVALID_ORIGIN' }
    }
    if (host && originHost === host) return { ok: true }
    if (xForwardedHost && originHost === xForwardedHost) return { ok: true }
    const trusted = trustedOrigins
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => {
        try {
          return new URL(t.includes('://') ? t : `https://${t}`).host
        } catch {
          return ''
        }
      })
      .filter(Boolean)
    if (trusted.includes(originHost)) return { ok: true }

    // Origin is not the proxy-facing host: fall back to the double-submit
    // cookie check (managed gateways rewrite Host, browsers keep Origin).
    if (csrfCookie && csrfHeader && csrfCookie === csrfHeader) return { ok: true }
    return { ok: false, reason: 'CSRF_BLOCKED' }
  }

  // No Origin header — non-browser client. Cookie check when provided,
  // otherwise allowed (unchanged legacy behaviour for API integrations).
  if (csrfHeader && !csrfCookie) return { ok: false, reason: 'CSRF_BLOCKED' }
  return { ok: true }
}

/** Trusted origins from the environment (never client-controlled). */
export function trustedOriginsFromEnv(): string[] {
  const raw = process.env.TRUSTED_ORIGINS ?? ''
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/** 192-bit random token via Web Crypto (Edge + Node compatible). */
export function newCsrfToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
