import { describe, it, expect } from 'vitest'
import {
  DOMAIN_STATUSES,
  isDomainStatus,
  ownershipVerified,
  servesTraffic,
  isRecheckable,
  statusLabel,
  apexWwwCompanion,
} from '@/lib/domains/status'
import { canonicalRedirectFor } from '@/lib/tenancy/resolver'

/**
 * Domain lifecycle status machine + canonical-host redirect decision.
 * Pure functions — these encode the security-relevant rules: which statuses
 * the resolver may serve, which are recheckable, and when the proxy
 * redirects a non-primary domain to the primary (www ↔ apex).
 */

describe('status machine', () => {
  it('has the full lifecycle vocabulary', () => {
    expect(DOMAIN_STATUSES).toEqual([
      'PENDING',
      'VERIFICATION_FAILED',
      'VERIFIED',
      'PENDING_DNS',
      'PENDING_SSL',
      'ACTIVE',
      'FAILED',
      'SUSPENDED',
    ])
  })

  it('only ACTIVE serves traffic', () => {
    for (const s of DOMAIN_STATUSES) {
      expect(servesTraffic(s)).toBe(s === 'ACTIVE')
    }
  })

  it('ownership is proven by every post-verification status except SUSPENDED/PENDING', () => {
    expect(ownershipVerified('VERIFIED')).toBe(true)
    expect(ownershipVerified('PENDING_DNS')).toBe(true)
    expect(ownershipVerified('PENDING_SSL')).toBe(true)
    expect(ownershipVerified('ACTIVE')).toBe(true)
    expect(ownershipVerified('FAILED')).toBe(true)
    expect(ownershipVerified('PENDING')).toBe(false)
    expect(ownershipVerified('VERIFICATION_FAILED')).toBe(false)
    expect(ownershipVerified('SUSPENDED')).toBe(false)
  })

  it('rechecks apply only to provider-assigned states', () => {
    expect(isRecheckable('PENDING_DNS')).toBe(true)
    expect(isRecheckable('PENDING_SSL')).toBe(true)
    expect(isRecheckable('ACTIVE')).toBe(true)
    expect(isRecheckable('FAILED')).toBe(true)
    expect(isRecheckable('VERIFIED')).toBe(false)
    expect(isRecheckable('PENDING')).toBe(false)
    expect(isRecheckable('SUSPENDED')).toBe(false)
  })

  it('labels map to truthful tones (green only for ACTIVE)', () => {
    expect(statusLabel('ACTIVE').tone).toBe('green')
    expect(statusLabel('PENDING').tone).toBe('amber')
    expect(statusLabel('VERIFICATION_FAILED').tone).toBe('red')
    expect(statusLabel('FAILED').tone).toBe('red')
    expect(statusLabel('SUSPENDED').tone).toBe('gray')
    expect(statusLabel('NOT_A_STATUS').tone).toBe('gray')
    expect(isDomainStatus('ACTIVE')).toBe(true)
    expect(isDomainStatus('BOGUS')).toBe(false)
  })
})

describe('www ↔ apex companions', () => {
  it('maps www to apex and a 2-label apex to www', () => {
    expect(apexWwwCompanion('www.gracecommunity.org')).toBe('gracecommunity.org')
    expect(apexWwwCompanion('gracecommunity.org')).toBe('www.gracecommunity.org')
  })

  it('deeper subdomains and www itself have no companion', () => {
    expect(apexWwwCompanion('uk.gracecommunity.org')).toBeNull()
    expect(apexWwwCompanion('www')).toBeNull()
    expect(apexWwwCompanion('www.uk.gracecommunity.org')).toBe('uk.gracecommunity.org')
  })
})

describe('canonical-host redirect decision', () => {
  const base = {
    churchId: 'c1',
    slug: 'grace-community',
  }

  it('redirects an ACTIVE non-primary custom domain to the primary (www ↔ apex)', () => {
    const resolved = { ...base, domain: 'gracecommunity.org', isPrimaryDomain: false, primaryDomain: 'www.gracecommunity.org' }
    expect(canonicalRedirectFor(resolved, '/', '')).toBe('https://www.gracecommunity.org/')
    expect(canonicalRedirectFor(resolved, '/about', '')).toBe('https://www.gracecommunity.org/about')
    expect(canonicalRedirectFor(resolved, '/events?x=1', '?x=1')).toBe('https://www.gracecommunity.org/events?x=1')
  })

  it('never redirects the primary domain itself', () => {
    const resolved = { ...base, domain: 'www.gracecommunity.org', isPrimaryDomain: true, primaryDomain: 'www.gracecommunity.org' }
    expect(canonicalRedirectFor(resolved, '/about', '')).toBeNull()
  })

  it('never redirects platform-subdomain resolutions', () => {
    const resolved = { ...base, domain: null, isPrimaryDomain: false, primaryDomain: null }
    expect(canonicalRedirectFor(resolved, '/about', '')).toBeNull()
  })

  it('never redirects when no primary exists (single-domain churches serve on their domain)', () => {
    const resolved = { ...base, domain: 'gracecommunity.org', isPrimaryDomain: false, primaryDomain: null }
    expect(canonicalRedirectFor(resolved, '/about', '')).toBeNull()
  })
})
