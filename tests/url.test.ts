import { describe, it, expect, afterEach } from 'vitest'
import { getPublicOrigin, requestOrigin, absoluteMediaUrl, churchSiteUrl } from '@/lib/url'

/**
 * Central URL utility — guarantees no localhost ever leaks into production
 * SEO URLs and that proxy-rewritten internal hosts are never canonicalised.
 */

const HD = (init: Record<string, string>) => new Headers(init)

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL
  delete process.env.NEXT_PUBLIC_APP_URL
})

describe('getPublicOrigin', () => {
  it('uses the explicit canonical configuration first', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.church-platform.example'
    expect(getPublicOrigin(HD({ host: 'internal.fcapp.run' }))).toBe(
      'https://www.church-platform.example'
    )
  })

  it('falls back to a genuine https request origin', () => {
    const h = HD({ 'x-forwarded-host': 'public.example', 'x-forwarded-proto': 'https' })
    expect(getPublicOrigin(h)).toBe('https://public.example')
  })

  it('NEVER canonicalises an internal proxy host', () => {
    // No configuration, http + fcapp.run host → must not be used.
    const h = HD({ host: 'ws-xyz.cn-hongkong-vpc.fcapp.run', 'x-forwarded-proto': 'http' })
    expect(getPublicOrigin(h)).toBe('http://localhost:3000')
  })

  it('ignores a legacy NEXT_PUBLIC_APP_URL pointing at localhost', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    expect(getPublicOrigin(null)).toBe('http://localhost:3000') // dev fallback, fine
    const h = HD({ host: 'ws-xyz.cn-hongkong-vpc.fcapp.run', 'x-forwarded-proto': 'http' })
    // With an https request origin available, localhost config must lose:
    const httpsReq = HD({ 'x-forwarded-host': 'public.example', 'x-forwarded-proto': 'https' })
    expect(getPublicOrigin(httpsReq)).toBe('https://public.example')
  })

  it('dev default with no headers and no config', () => {
    expect(getPublicOrigin(null)).toBe('http://localhost:3000')
  })
})

describe('requestOrigin', () => {
  it('derives https origin from forwarded headers', () => {
    expect(
      requestOrigin(HD({ 'x-forwarded-host': 'a.example', 'x-forwarded-proto': 'https' }))
    ).toBe('https://a.example')
  })

  it('returns null for localhost/loopback/internal hosts', () => {
    expect(requestOrigin(HD({ host: 'localhost:3000', 'x-forwarded-proto': 'http' }))).toBeNull()
    expect(requestOrigin(HD({ host: '127.0.0.1:3000', 'x-forwarded-proto': 'https' }))).toBeNull()
    expect(requestOrigin(HD({ host: 'x.fcapp.run', 'x-forwarded-proto': 'https' }))).toBeNull()
    expect(requestOrigin(null)).toBeNull()
  })
})

describe('churchSiteUrl / absoluteMediaUrl', () => {
  it('builds church paths', () => {
    expect(churchSiteUrl('https://o.example', 'grace-community')).toBe(
      'https://o.example/church/grace-community'
    )
    expect(churchSiteUrl('https://o.example', 'grace', 'sermons/abc')).toBe(
      'https://o.example/church/grace/sermons/abc'
    )
  })

  it('absolutises relative media paths and passes external URLs through', () => {
    expect(absoluteMediaUrl('https://o.example', '/api/media/abc/file')).toBe(
      'https://o.example/api/media/abc/file'
    )
    expect(absoluteMediaUrl('https://o.example', 'https://cdn.example/img.jpg')).toBe(
      'https://cdn.example/img.jpg'
    )
  })

  it('returns null for unsafe/empty image values (falls back to defaults)', () => {
    expect(absoluteMediaUrl('https://o.example', null)).toBeNull()
    expect(absoluteMediaUrl('https://o.example', '')).toBeNull()
    expect(absoluteMediaUrl('https://o.example', 'javascript:alert(1)')).toBeNull()
    expect(absoluteMediaUrl('https://o.example', 'http://localhost:3000/x.png')).toBeNull()
  })
})
