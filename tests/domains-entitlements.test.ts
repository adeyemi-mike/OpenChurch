import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  resolveEntitlement,
  planDomainLimit,
  normalizePlan,
  DEFAULT_DOMAIN_LIMITS,
  DOMAIN_PLANS,
} from '@/lib/domains/entitlements'

/**
 * Custom-domain plan entitlements — the clean interface a future billing
 * integration plugs into. Limits are operator-configured via
 * DOMAIN_LIMIT_<PLAN>; no pricing is hardcoded anywhere.
 */

const SAVED: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const v of ['DOMAIN_LIMIT_FREE', 'DOMAIN_LIMIT_PAID', 'DOMAIN_LIMIT_PREMIUM']) {
    SAVED[v] = process.env[v]
    delete process.env[v]
  }
})

afterEach(() => {
  for (const [k, v] of Object.entries(SAVED)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('plan normalization', () => {
  it('accepts the known plans and falls back to free', () => {
    expect(DOMAIN_PLANS).toEqual(['free', 'paid', 'premium'])
    expect(normalizePlan('PAID')).toBe('paid')
    expect(normalizePlan('premium')).toBe('premium')
    expect(normalizePlan('enterprise')).toBe('free')
    expect(normalizePlan(null)).toBe('free')
    expect(normalizePlan(undefined)).toBe('free')
  })
})

describe('plan domain limits', () => {
  it('defaults: free 0, paid 1, premium 10', () => {
    expect(DEFAULT_DOMAIN_LIMITS).toEqual({ free: 0, paid: 1, premium: 10 })
    expect(planDomainLimit('free')).toBe(0)
    expect(planDomainLimit('paid')).toBe(1)
    expect(planDomainLimit('premium')).toBe(10)
  })

  it('operators can override per plan via env', () => {
    process.env.DOMAIN_LIMIT_PAID = '3'
    process.env.DOMAIN_LIMIT_FREE = '1'
    expect(planDomainLimit('paid')).toBe(3)
    expect(planDomainLimit('free')).toBe(1)
  })

  it('clamps nonsense values to the defaults (never unlimited)', () => {
    process.env.DOMAIN_LIMIT_PREMIUM = 'not-a-number'
    expect(planDomainLimit('premium')).toBe(10)
    process.env.DOMAIN_LIMIT_PREMIUM = '-5'
    expect(planDomainLimit('premium')).toBe(10)
    process.env.DOMAIN_LIMIT_PREMIUM = '9999'
    expect(planDomainLimit('premium')).toBe(100)
  })
})

describe('entitlement resolution', () => {
  it('free plan with 0 used: cannot add, hint mentions the operator (no pricing)', () => {
    const e = resolveEntitlement('free', 0)
    expect(e).toMatchObject({ plan: 'free', limit: 0, used: 0, canAdd: false })
    expect(e.upgradeHint).toContain('platform operator')
    expect(e.upgradeHint).not.toMatch(/[$₤€]|USD|NGN|price/i)
  })

  it('paid plan with headroom: can add', () => {
    const e = resolveEntitlement('paid', 0)
    expect(e.canAdd).toBe(true)
    expect(e.upgradeHint).toBeNull()
  })

  it('paid plan at the limit: cannot add a second domain', () => {
    const e = resolveEntitlement('paid', 1)
    expect(e.canAdd).toBe(false)
  })

  it('premium plan with multiple domains still has headroom', () => {
    const e = resolveEntitlement('premium', 9)
    expect(e.canAdd).toBe(true)
    expect(resolveEntitlement('premium', 10).canAdd).toBe(false)
  })

  it('an unknown plan value degrades to free (safe default)', () => {
    const e = resolveEntitlement('whatever', 0)
    expect(e.plan).toBe('free')
    expect(e.limit).toBe(0)
  })
})
