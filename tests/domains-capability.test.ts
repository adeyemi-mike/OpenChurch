import { describe, it, expect, afterEach } from 'vitest'
import { getDomainCapability, domainsOperable } from '@/lib/domains/capability'

/**
 * Custom-domain capability derivation: which deployment model the platform
 * honestly reports, from provider credentials, serverless detection and the
 * explicit operator override. The hosted demonstration must report
 * "unavailable" — never a workflow it cannot complete.
 */

const KEYS = ['VERCEL', 'VERCEL_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_TEAM_ID', 'CUSTOM_DOMAIN_MODE'] as const
let saved: Record<string, string | undefined> = {}

function capture() {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
}
function restore() {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

function clearAll() {
  for (const k of KEYS) delete process.env[k]
}

describe('domain capability derivation', () => {
  afterEach(restore)

  it('defaults to the self-hosted manual workflow on a plain server', () => {
    capture()
    clearAll()
    const cap = getDomainCapability()
    expect(cap.mode).toBe('self-hosted')
    expect(cap.automated).toBe(false)
    expect(domainsOperable(cap)).toBe(true)
  })

  it('serverless runtime without provider credentials → unavailable (hosted demonstration)', () => {
    capture()
    clearAll()
    process.env.VERCEL = '1'
    const cap = getDomainCapability()
    expect(cap.mode).toBe('unavailable')
    expect(cap.automated).toBe(false)
    expect(domainsOperable(cap)).toBe(false)
    // The explanation must reference the real reason, not a fake workflow.
    expect(cap.summary).toMatch(/domain-assignment integration/)
  })

  it('provider credentials + serverless → managed hosting with automation', () => {
    capture()
    clearAll()
    process.env.VERCEL = '1'
    process.env.VERCEL_TOKEN = 'tok'
    process.env.VERCEL_PROJECT_ID = 'proj'
    const cap = getDomainCapability()
    expect(cap.mode).toBe('managed-auto')
    expect(cap.automated).toBe(true)
    expect(domainsOperable(cap)).toBe(true)
  })

  it('provider credentials on an always-on server → managed hosting with automation', () => {
    capture()
    clearAll()
    process.env.VERCEL_TOKEN = 'tok'
    process.env.VERCEL_PROJECT_ID = 'proj'
    expect(getDomainCapability().mode).toBe('managed-auto')
  })

  it('one credential alone is NOT enough for automation (never half-configured)', () => {
    capture()
    clearAll()
    process.env.VERCEL_TOKEN = 'tok'
    expect(getDomainCapability().mode).toBe('self-hosted')
    clearAll()
    process.env.VERCEL = '1'
    process.env.VERCEL_TOKEN = 'tok'
    expect(getDomainCapability().mode).toBe('unavailable')
  })

  it('CUSTOM_DOMAIN_MODE=manual wins even on serverless with credentials declared elsewhere', () => {
    capture()
    clearAll()
    process.env.VERCEL = '1'
    process.env.CUSTOM_DOMAIN_MODE = 'manual'
    expect(getDomainCapability().mode).toBe('self-hosted')
  })

  it('CUSTOM_DOMAIN_MODE=off always reports unavailable (even with credentials)', () => {
    capture()
    clearAll()
    process.env.VERCEL_TOKEN = 'tok'
    process.env.VERCEL_PROJECT_ID = 'proj'
    process.env.CUSTOM_DOMAIN_MODE = 'off'
    const cap = getDomainCapability()
    expect(cap.mode).toBe('unavailable')
    expect(domainsOperable(cap)).toBe(false)
  })

  it('CUSTOM_DOMAIN_MODE=auto without credentials falls through honestly (no fake automation)', () => {
    capture()
    clearAll()
    process.env.CUSTOM_DOMAIN_MODE = 'auto'
    // No VERCEL env, no tokens: an always-on server → manual workflow.
    expect(getDomainCapability().mode).toBe('self-hosted')
    clearAll()
    process.env.VERCEL = '1'
    process.env.CUSTOM_DOMAIN_MODE = 'auto'
    // Serverless without credentials → unavailable, not "auto".
    expect(getDomainCapability().mode).toBe('unavailable')
  })

  it('CUSTOM_DOMAIN_MODE=auto with credentials → managed hosting', () => {
    capture()
    clearAll()
    process.env.CUSTOM_DOMAIN_MODE = 'auto'
    process.env.VERCEL_TOKEN = 'tok'
    process.env.VERCEL_PROJECT_ID = 'proj'
    expect(getDomainCapability().mode).toBe('managed-auto')
  })

  it('accepts the documented alias spellings for the override', () => {
    capture()
    clearAll()
    process.env.CUSTOM_DOMAIN_MODE = 'self-hosted'
    expect(getDomainCapability().mode).toBe('self-hosted')
    clearAll()
    process.env.CUSTOM_DOMAIN_MODE = 'disabled'
    expect(getDomainCapability().mode).toBe('unavailable')
  })
})
