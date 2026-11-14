import { describe, it, expect, beforeEach } from 'vitest'
import { validateCustomDomain, txtRecordName } from '@/lib/domains/validate'

/**
 * Custom-domain validation & normalisation — pure functions.
 * Security-relevant: rejects IPs, localhost, ports, paths, platform
 * suffixes and the deployment's own hostnames.
 */

describe('validateCustomDomain — accepts', () => {
  it('normalises a plain www domain', () => {
    expect(validateCustomDomain('www.gracecommunity.org')).toEqual({
      ok: true,
      domain: 'www.gracecommunity.org',
    })
  })

  it('lowercases and strips a trailing dot', () => {
    expect(validateCustomDomain('WWW.GraceCommunity.ORG.')).toEqual({
      ok: true,
      domain: 'www.gracecommunity.org',
    })
  })

  it('accepts an apex domain', () => {
    expect(validateCustomDomain('gracecommunity.org')).toEqual({ ok: true, domain: 'gracecommunity.org' })
  })

  it('accepts a subdomain', () => {
    expect(validateCustomDomain('church.example.org')).toEqual({ ok: true, domain: 'church.example.org' })
  })

  it('accepts a pasted https URL and extracts the hostname', () => {
    expect(validateCustomDomain('https://www.gracecommunity.org/some/path')).toEqual({
      ok: true,
      domain: 'www.gracecommunity.org',
    })
  })

  it('accepts punycode (IDN) form', () => {
    expect(validateCustomDomain('xn--kirche-qla.org')).toEqual({
      ok: true,
      domain: 'xn--kirche-qla.org',
    })
  })
})

describe('validateCustomDomain — rejects', () => {
  const cases: [string, string][] = [
    ['', 'empty'],
    ['gracecommunity', 'single label — no dot'],
    ['http://127.0.0.1:3000', 'loopback IP with port'],
    ['192.168.1.10', 'private IP'],
    ['8.8.8.8', 'public IP'],
    ['localhost', 'localhost'],
    ['app.localhost', 'localhost subdomain'],
    ['www.gracecommunity.org:8080', 'port'],
    ['www.gracecommunity.org/path', 'path'],
    ['www.gracecommunity.org?q=1', 'query'],
    ['ftp://gracecommunity.org', 'non-http protocol'],
    ['javascript:alert(1)', 'unsafe scheme'],
    ['open-church-one.vercel.app', 'hosting platform suffix'],
    ['myapp.neon.tech', 'database platform suffix'],
    ['v12hk9yeagh1-d.space-z.ai', 'this platform (sandbox)'],
    ['grace\ncommunity.org', 'embedded newline injection'],
    ['grace community.org', 'space in hostname'],
    ['-bad.org', 'leading hyphen label'],
    ['bad-.org', 'trailing hyphen label'],
    ['教堂.org', 'non-ASCII (must use punycode)'],
  ]
  for (const [input, label] of cases) {
    it(`rejects ${label} (${input.replace(/\n/g, '\\n')})`, () => {
      const res = validateCustomDomain(input)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.length).toBeGreaterThan(0)
    })
  }

  it('rejects the deployment origin from NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://churches.example.com'
    try {
      expect(validateCustomDomain('churches.example.com').ok).toBe(false)
      expect(validateCustomDomain('www.churches.example.com').ok).toBe(false)
      expect(validateCustomDomain('other.example.com').ok).toBe(true)
    } finally {
      delete process.env.NEXT_PUBLIC_SITE_URL
    }
  })
})

describe('txtRecordName', () => {
  it('builds the verification record name', () => {
    expect(txtRecordName('gracecommunity.org')).toBe('_openchurch-verify.gracecommunity.org')
  })
})
