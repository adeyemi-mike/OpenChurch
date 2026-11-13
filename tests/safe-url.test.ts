import { describe, it, expect } from 'vitest'
import { safeExternalUrl } from '@/lib/url'

/**
 * External-link validation for public-site buttons: social profiles, event
 * registration, giving links. A link the validator rejects must be hidden,
 * never rendered — a generic platform homepage or a placeholder domain
 * must not masquerade as a church profile.
 */

describe('safeExternalUrl', () => {
  it('accepts real profile URLs unchanged (normalised)', () => {
    expect(safeExternalUrl('https://x.com/openchurch')).toBe('https://x.com/openchurch')
    expect(safeExternalUrl('https://instagram.com/gracecommunity')).toContain('instagram.com/gracecommunity')
    expect(safeExternalUrl('https://paystack.shop/pay/grace')).toBe('https://paystack.shop/pay/grace')
  })

  it('accepts URLs without an explicit scheme', () => {
    expect(safeExternalUrl('facebook.com/gracecommunity')).toBe('https://facebook.com/gracecommunity')
  })

  it('rejects empty/null values', () => {
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl('   ')).toBeNull()
  })

  it('rejects placeholder domains', () => {
    expect(safeExternalUrl('https://example.com')).toBeNull()
    expect(safeExternalUrl('https://example.com/register')).toBeNull()
    expect(safeExternalUrl('example.org/event')).toBeNull()
  })

  it('rejects bare social-platform homepages', () => {
    expect(safeExternalUrl('https://x.com')).toBeNull()
    expect(safeExternalUrl('https://x.com/')).toBeNull()
    expect(safeExternalUrl('https://twitter.com')).toBeNull()
    expect(safeExternalUrl('https://facebook.com')).toBeNull()
    expect(safeExternalUrl('https://instagram.com')).toBeNull()
    expect(safeExternalUrl('https://youtube.com')).toBeNull()
    expect(safeExternalUrl('https://tiktok.com')).toBeNull()
  })

  it('accepts social URLs with a real profile path', () => {
    expect(safeExternalUrl('https://x.com/GraceChurchUK')).not.toBeNull()
    expect(safeExternalUrl('https://www.youtube.com/@gracecommunity')).not.toBeNull()
  })

  it('rejects internal/localhost hosts and non-http(s) schemes', () => {
    expect(safeExternalUrl('http://localhost:3000/console')).toBeNull()
    expect(safeExternalUrl('https://127.0.0.1/admin')).toBeNull()
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('ftp://files.example.com/doc.pdf')).toBeNull()
  })

  it('rejects malformed values', () => {
    expect(safeExternalUrl('not a url')).toBeNull()
  })
})
