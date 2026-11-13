import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Server-controlled demonstration mode.
 *
 * The decision function must be fail-safe: with no configuration, demo mode
 * is OFF in production and ON in development. Explicit DEMO_MODE=true is the
 * only opt-in for hosted demo deployments. The advertised account list must
 * never include a platform-administrator account.
 */

const ORIGINAL = { DEMO_MODE: process.env.DEMO_MODE, NODE_ENV: process.env.NODE_ENV }

beforeEach(() => {
  delete process.env.DEMO_MODE
})

afterEach(() => {
  if (ORIGINAL.DEMO_MODE === undefined) delete process.env.DEMO_MODE
  else process.env.DEMO_MODE = ORIGINAL.DEMO_MODE
  vi.unstubAllEnvs()
  // The module reads env on every call, but vitest caches imports —
  // dynamic re-import keeps each case independent.
})

async function freshGate() {
  const mod = await import('@/lib/demo-mode')
  return mod
}

describe('isDemoModeEnabled', () => {
  it('defaults to OFF in production when unset', async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { isDemoModeEnabled } = await freshGate()
    expect(isDemoModeEnabled()).toBe(false)
  })

  it('defaults to ON in development when unset', async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { isDemoModeEnabled } = await freshGate()
    expect(isDemoModeEnabled()).toBe(true)
  })

  it('honours explicit DEMO_MODE=true even in production', async () => {
    vi.stubEnv("NODE_ENV", "production")
    process.env.DEMO_MODE = 'true'
    const { isDemoModeEnabled } = await freshGate()
    expect(isDemoModeEnabled()).toBe(true)
  })

  it('honours explicit DEMO_MODE=false even in development', async () => {
    vi.stubEnv("NODE_ENV", "development")
    process.env.DEMO_MODE = 'false'
    const { isDemoModeEnabled } = await freshGate()
    expect(isDemoModeEnabled()).toBe(false)
  })

  it('treats junk values as disabled (fail safe)', async () => {
    vi.stubEnv("NODE_ENV", "production")
    process.env.DEMO_MODE = 'yes please'
    const { isDemoModeEnabled } = await freshGate()
    expect(isDemoModeEnabled()).toBe(false)
  })
})

describe('demoModePresentation', () => {
  it('returns null when demo mode is disabled', async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { demoModePresentation } = await freshGate()
    expect(demoModePresentation()).toBeNull()
  })

  it('never advertises a platform-administrator account', async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { demoModePresentation } = await freshGate()
    const demo = demoModePresentation()
    expect(demo).not.toBeNull()
    const emails = demo!.accounts.map((a) => a.email)
    expect(emails).not.toContain('admin@openchurch.dev')
    expect(emails.every((e) => e.endsWith('.demo'))).toBe(true)
  })
})
