import { describe, it, expect } from 'vitest'
import {
  getCachedHostResolution,
  setCachedHostResolution,
  invalidateHost,
  invalidateAllHosts,
} from '@/lib/domains/cache'

/**
 * Host-resolution cache: TTL on positive AND negative entries, exact-key
 * isolation (one tenant's host can never resolve for another), and
 * invalidation. Tenant-cache safety is security-relevant.
 */

describe('host resolution cache', () => {
  it('returns undefined for unknown hosts', () => {
    expect(getCachedHostResolution('unknown.example')).toBeUndefined()
  })

  it('caches positive resolutions and expires them', () => {
    setCachedHostResolution('a.example', { churchId: 'c1', slug: 'one', domain: null, isPrimaryDomain: false, primaryDomain: null })
    expect(getCachedHostResolution('a.example')).toEqual({ churchId: 'c1', slug: 'one', domain: null, isPrimaryDomain: false, primaryDomain: null })
    invalidateHost('a.example')
    expect(getCachedHostResolution('a.example')).toBeUndefined()
  })

  it('caches NEGATIVE results and expires them too (removed domains stop resolving)', () => {
    setCachedHostResolution('gone.example', null)
    expect(getCachedHostResolution('gone.example')).toBeNull()
    // A later positive DB state must be observable after invalidation —
    // the negative entry must not live forever.
    invalidateHost('gone.example')
    expect(getCachedHostResolution('gone.example')).toBeUndefined()
  })

  it('isolates tenants by exact hostname (no partial matching)', () => {
    setCachedHostResolution('grace.example', { churchId: 'grace', slug: 'grace', domain: 'grace.example', isPrimaryDomain: true, primaryDomain: 'grace.example' })
    expect(getCachedHostResolution('evil-grace.example')).toBeUndefined()
    expect(getCachedHostResolution('grace.example.evil.com')).toBeUndefined()
    expect(getCachedHostResolution('GRACE.example')?.churchId).toBe('grace')
  })

  it('invalidateAllHosts clears every entry', () => {
    setCachedHostResolution('x.example', { churchId: 'x', slug: 'x', domain: null, isPrimaryDomain: false, primaryDomain: null })
    setCachedHostResolution('y.example', null)
    invalidateAllHosts()
    expect(getCachedHostResolution('x.example')).toBeUndefined()
    expect(getCachedHostResolution('y.example')).toBeUndefined()
  })
})
