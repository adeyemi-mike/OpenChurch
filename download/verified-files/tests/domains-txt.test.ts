import { describe, it, expect } from 'vitest'
import {
  generateVerificationToken,
  hashVerificationToken,
  checkOwnershipTxt,
  TXT_PREFIX,
  type TxtResolver,
} from '@/lib/domains/txt'

/**
 * TXT ownership-verification primitives: token randomness/hashing and the
 * DNS check logic with an injected resolver (no network in tests).
 */

describe('generateVerificationToken', () => {
  it('produces 64 hex chars (256 bits)', () => {
    const t = generateVerificationToken()
    expect(t).toMatch(/^[0-9a-f]{64}$/)
  })

  it('never repeats (CSPRNG)', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateVerificationToken()))
    expect(seen.size).toBe(200)
  })
})

describe('hashVerificationToken', () => {
  it('is a stable SHA-256 hex digest', () => {
    expect(hashVerificationToken('abc')).toBe(hashVerificationToken('abc'))
    expect(hashVerificationToken('abc')).toMatch(/^[0-9a-f]{64}$/)
    expect(hashVerificationToken('abc')).not.toBe(hashVerificationToken('abd'))
  })
})

describe('checkOwnershipTxt', () => {
  const token = 'a'.repeat(64)
  const good: TxtResolver = async () => [[`${TXT_PREFIX}${token}`]]

  it('verifies when the record carries the exact token', async () => {
    const res = await checkOwnershipTxt('gracecommunity.org', token, good)
    expect(res.ok).toBe(true)
  })

  it('verifies when the value is split into multiple character-strings', async () => {
    // Long TXT values are commonly split into 255-byte chunks.
    const half = token.length / 2
    const split: TxtResolver = async () => [[TXT_PREFIX, token.slice(0, half), token.slice(half)]]
    const res = await checkOwnershipTxt('gracecommunity.org', token, split)
    expect(res.ok).toBe(true)
  })

  it('verifies when a second record in the set matches', async () => {
    const multi: TxtResolver = async () => [['spf-record-here'], [`${TXT_PREFIX}${token}`]]
    const res = await checkOwnershipTxt('gracecommunity.org', token, multi)
    expect(res.ok).toBe(true)
  })

  it('fails with a reason when no record exists (ENOTFOUND)', async () => {
    const none: TxtResolver = async () => {
      const err = new Error('not found') as NodeJS.ErrnoException
      err.code = 'ENOTFOUND'
      throw err
    }
    const res = await checkOwnershipTxt('gracecommunity.org', token, none)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('No TXT record')
  })

  it('fails with a reason on DNS timeout', async () => {
    const timeout: TxtResolver = async () => {
      const err = new Error('timeout') as NodeJS.ErrnoException
      err.code = 'ETIMEOUT'
      throw err
    }
    const res = await checkOwnershipTxt('gracecommunity.org', token, timeout)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('timed out')
  })

  it('fails when the record carries a DIFFERENT token', async () => {
    const wrong: TxtResolver = async () => [[`${TXT_PREFIX}${'b'.repeat(64)}`]]
    const res = await checkOwnershipTxt('gracecommunity.org', token, wrong)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('does not carry the expected value')
  })
})
