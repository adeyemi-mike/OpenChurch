import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { rmSync } from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'

/**
 * Password recovery token lifecycle — single-use, hashed storage, expiry,
 * and full session revocation on success. Runs against a throwaway SQLite
 * database (never the dev database).
 */

const TEST_DB = path.resolve('/tmp/openchurch-test-reset.db')

let db: Awaited<ReturnType<typeof importPrismaClient>>
let createPasswordResetToken: typeof import('@/lib/auth/password-reset').createPasswordResetToken
let validatePasswordResetToken: typeof import('@/lib/auth/password-reset').validatePasswordResetToken
let consumePasswordResetToken: typeof import('@/lib/auth/password-reset').consumePasswordResetToken

async function importPrismaClient() {
  const { PrismaClient } = await import('@prisma/client')
  return new PrismaClient()
}

beforeAll(async () => {
  rmSync(TEST_DB, { force: true })
  process.env.DATABASE_URL = `file:${TEST_DB}`
  execSync('bunx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
  })
  db = await importPrismaClient()
  const mod = await import('@/lib/auth/password-reset')
  createPasswordResetToken = mod.createPasswordResetToken
  validatePasswordResetToken = mod.validatePasswordResetToken
  consumePasswordResetToken = mod.consumePasswordResetToken
})

afterAll(async () => {
  await db.$disconnect()
  rmSync(TEST_DB, { force: true })
})

describe('password reset tokens', () => {
  it('stores only a hash — the raw token is never persisted', async () => {
    const user = await db.user.create({
      data: {
        email: 'reset@test.dev',
        name: 'Reset User',
        passwordHash: await bcrypt.hash('OldPass123', 10),
      },
    })
    const token = await createPasswordResetToken(user.id)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const rows = await db.passwordResetToken.findMany({ where: { userId: user.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].tokenHash).not.toBe(token)
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('validates a fresh token and rejects unknown ones', async () => {
    const user = await db.user.create({
      data: { email: 'v@test.dev', name: 'V', passwordHash: 'x' },
    })
    const token = await createPasswordResetToken(user.id)
    expect(await validatePasswordResetToken(token)).toBe(user.id)
    expect(await validatePasswordResetToken('deadbeef'.repeat(8))).toBeNull()
  })

  it('consumes a token exactly once and revokes all sessions', async () => {
    const user = await db.user.create({
      data: { email: 'c@test.dev', name: 'C', passwordHash: 'x' },
    })
    // An existing, pre-reset session must disappear after the reset.
    const { PrismaClient } = await import('@prisma/client')
    const { createHash } = await import('crypto')
    const dbx = new PrismaClient()
    await dbx.session.create({
      data: { userId: user.id, tokenHash: createHash('sha256').update('session-token-1').digest('hex'), expiresAt: new Date(Date.now() + 86_400_000) },
    })

    const token = await createPasswordResetToken(user.id)
    const newHash = await bcrypt.hash('NewPass123!', 10)
    const ok = await consumePasswordResetToken(token, newHash)
    expect(ok).toBe(true)

    const sessions = await dbx.session.findMany({ where: { userId: user.id } })
    expect(sessions).toHaveLength(0) // session revocation
    const updated = await dbx.user.findUnique({ where: { id: user.id } })
    expect(await bcrypt.compare('NewPass123!', updated!.passwordHash)).toBe(true)
    await dbx.$disconnect()

    // Second use must fail (single-use).
    const second = await consumePasswordResetToken(token, newHash)
    expect(second).toBe(false)
  })

  it('rejects expired tokens', async () => {
    const user = await db.user.create({
      data: { email: 'e@test.dev', name: 'E', passwordHash: 'x' },
    })
    const token = await createPasswordResetToken(user.id)
    // Force-expire the stored record.
    const row = await db.passwordResetToken.findFirst({ where: { userId: user.id } })
    await db.passwordResetToken.update({
      where: { id: row!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    expect(await validatePasswordResetToken(token)).toBeNull()
  })
})
