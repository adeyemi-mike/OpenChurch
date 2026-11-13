import { describe, it, expect } from 'vitest'
import { verifyCsrf, CSRF_COOKIE, CSRF_HEADER } from '@/lib/auth/csrf'

/**
 * CSRF verification matrix — the layered defence that keeps browser logins
 * working behind Host-rewriting proxies while blocking cross-site posts.
 *
 * Threat model reminder: a cross-site attacker can craft a form POST (Origin
 * attacker.com) but can neither read the SameSite=Lax csrf cookie nor set a
 * custom header cross-origin without CORS approval.
 */

const base = {
  host: 'internal-fcapp.run', // proxy-rewritten internal host
  xForwardedHost: 'internal-fcapp.run',
  trustedOrigins: [] as string[],
}

describe('verifyCsrf', () => {
  it('passes when Origin matches the request host (direct topology)', () => {
    expect(
      verifyCsrf({ ...base, host: 'church.example', xForwardedHost: null, origin: 'https://church.example', csrfCookie: null, csrfHeader: null })
    ).toEqual({ ok: true })
  })

  it('passes when Origin matches X-Forwarded-Host', () => {
    expect(
      verifyCsrf({ ...base, xForwardedHost: 'church.example', origin: 'https://church.example', csrfCookie: null, csrfHeader: null })
    ).toEqual({ ok: true })
  })

  it('passes via TRUSTED_ORIGINS allow-list', () => {
    expect(
      verifyCsrf({
        ...base,
        trustedOrigins: ['https://public-origin.example'],
        origin: 'https://public-origin.example',
        csrfCookie: null,
        csrfHeader: null,
      })
    ).toEqual({ ok: true })
  })

  it('PASSES a rewritten-host same-origin request with a valid double-submit pair', () => {
    // This is the managed-gateway topology: Origin (public) != Host (internal).
    expect(
      verifyCsrf({
        ...base,
        origin: 'https://deployed-site.example',
        csrfCookie: 'tok123',
        csrfHeader: 'tok123',
      })
    ).toEqual({ ok: true })
  })

  it('BLOCKS cross-site origin without the csrf cookie pair', () => {
    const verdict = verifyCsrf({
      ...base,
      origin: 'https://attacker.example',
      csrfCookie: 'tok123',
      csrfHeader: undefined as unknown as string | null,
    })
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('CSRF_BLOCKED')
  })

  it('BLOCKS mismatched cookie/header values (forged or stale pair)', () => {
    expect(
      verifyCsrf({ ...base, origin: 'https://attacker.example', csrfCookie: 'tok1', csrfHeader: 'tok2' }).ok
    ).toBe(false)
    // An attacker who knows the cookie NAME but not the value cannot pass:
    expect(
      verifyCsrf({ ...base, origin: 'https://attacker.example', csrfCookie: null, csrfHeader: 'guessed' }).ok
    ).toBe(false)
  })

  it('BLOCKS malformed Origin URLs', () => {
    const verdict = verifyCsrf({
      ...base,
      origin: 'not-a-url',
      csrfCookie: 'tok123',
      csrfHeader: 'tok123',
    })
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('INVALID_ORIGIN')
  })

  it('allows non-browser requests without Origin (legacy API behaviour)', () => {
    expect(
      verifyCsrf({ ...base, origin: null, csrfCookie: null, csrfHeader: null })
    ).toEqual({ ok: true })
  })

  it('rejects header-echo without the cookie when Origin is absent', () => {
    expect(
      verifyCsrf({ ...base, origin: null, csrfCookie: null, csrfHeader: 'tok' }).ok
    ).toBe(false)
  })

  it('exposes stable cookie/header names', () => {
    expect(CSRF_COOKIE).toBe('openchurch_csrf')
    expect(CSRF_HEADER).toBe('x-csrf-token')
  })
})
