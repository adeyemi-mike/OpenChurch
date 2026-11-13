import { describe, it, expect } from 'vitest'
import { isSafeNavHref } from '@/lib/validation/entities'

/**
 * Navigation destination validation — public menu items must never carry
 * executable or malformed destinations (javascript:, data:, traversal…).
 */
describe('isSafeNavHref', () => {
  it('accepts site-relative paths used by the demo data', () => {
    for (const href of ['/', '/about', '/ministries', '/events', '/sermons', '/give', '/contact']) {
      expect(isSafeNavHref(href), href).toBe(true)
    }
  })

  it('accepts in-page anchors and https URLs', () => {
    expect(isSafeNavHref('#visitors')).toBe(true)
    expect(isSafeNavHref('https://www.gracecommunity.org')).toBe(true)
    expect(isSafeNavHref('http://example.org/page')).toBe(true)
  })

  it('rejects executable and dangerous schemes', () => {
    expect(isSafeNavHref('javascript:alert(1)')).toBe(false)
    expect(isSafeNavHref('JavaScript:alert(1)')).toBe(false)
    expect(isSafeNavHref('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeNavHref('vbscript:msgbox(1)')).toBe(false)
  })

  it('rejects traversal, control characters and bare words', () => {
    expect(isSafeNavHref('/../../etc/passwd')).toBe(false)
    expect(isSafeNavHref('about')).toBe(false)
    expect(isSafeNavHref('java\nscript:alert(1)')).toBe(false)
    expect(isSafeNavHref('')).toBe(false)
  })
})
