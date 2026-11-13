import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, clientIp } from '@/lib/rate-limit'

beforeEach(() => {
  // Distinct keys per test so window state doesn't bleed between tests.
})

describe('rateLimit (sliding window)', () => {
  it('allows up to the limit then blocks', () => {
    const key = `t1-${Math.random()}`
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).allowed).toBe(true)
    }
    const blocked = rateLimit(key, 5, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    expect(blocked.remaining).toBe(0)
  })

  it('counts remaining correctly', () => {
    const key = `t2-${Math.random()}`
    expect(rateLimit(key, 3, 60_000).remaining).toBe(2)
    expect(rateLimit(key, 3, 60_000).remaining).toBe(1)
    expect(rateLimit(key, 3, 60_000).remaining).toBe(0)
    expect(rateLimit(key, 3, 60_000).allowed).toBe(false)
  })

  it('resets after the window passes', async () => {
    const key = `t3-${Math.random()}`
    for (let i = 0; i < 2; i++) rateLimit(key, 2, 30)
    expect(rateLimit(key, 2, 30).allowed).toBe(false)
    await new Promise((r) => setTimeout(r, 60))
    expect(rateLimit(key, 2, 30).allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    const a = `t4a-${Math.random()}`
    const b = `t4b-${Math.random()}`
    rateLimit(a, 1, 60_000)
    expect(rateLimit(a, 1, 60_000).allowed).toBe(false)
    expect(rateLimit(b, 1, 60_000).allowed).toBe(true)
  })
})

describe('clientIp', () => {
  it('prefers x-real-ip, then x-forwarded-for, then unknown', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '1.2.3.4' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers({ 'x-forwarded-for': '5.6.7.8, 9.10.11.12' }))).toBe('5.6.7.8')
    expect(clientIp(new Headers())).toBe('unknown')
  })
})
