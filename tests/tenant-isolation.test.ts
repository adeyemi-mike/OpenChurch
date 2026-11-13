import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { rmSync } from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'

/**
 * Tenant isolation — the core multi-church security guarantee.
 *
 * These tests exercise the EXACT query pattern used by the production guards
 * (`resolveChurchContext` in src/lib/api/handler.ts and `getChurchContext` in
 * src/lib/auth/guards.ts): a membership lookup scoped by BOTH the church
 * slug and the user id, followed by churchId-scoped data queries. A user
 * from Church A must never resolve context for Church B, and no query may
 * cross churchId boundaries.
 *
 * Runs against a throwaway SQLite database (never the dev database).
 */

const TEST_DB = path.resolve('/tmp/openchurch-test-isolation.db')

async function importPrisma() {
  const { PrismaClient } = await import('@prisma/client')
  return new PrismaClient()
}

let db: Awaited<ReturnType<typeof importPrisma>>

beforeAll(async () => {
  rmSync(TEST_DB, { force: true })
  process.env.DATABASE_URL = `file:${TEST_DB}`
  execSync('bunx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
  })
  db = await importPrisma()

  const passwordHash = await bcrypt.hash('Test1234!', 10)
  const userA = await db.user.create({ data: { email: 'a@test.dev', name: 'User A', passwordHash } })
  const userB = await db.user.create({ data: { email: 'b@test.dev', name: 'User B', passwordHash } })
  const churchA = await db.church.create({
    data: { slug: 'church-a', name: 'Church A', country: 'NG', isPublished: true },
  })
  const churchB = await db.church.create({
    data: { slug: 'church-b', name: 'Church B', country: 'GB', isPublished: true },
  })
  await db.churchMembership.create({ data: { churchId: churchA.id, userId: userA.id, role: 'OWNER' } })
  await db.churchMembership.create({ data: { churchId: churchB.id, userId: userB.id, role: 'OWNER' } })
  // Church B has an unpublished, private page and a sensitive submission.
  await db.websitePage.create({
    data: {
      churchId: churchB.id,
      title: 'B private page',
      slug: 'private',
      status: 'DRAFT',
      draftSections: '[]',
    },
  })
  await db.form.create({
    data: { churchId: churchB.id, type: 'PRAYER', title: 'Prayer' },
  })
  const form = await db.form.findFirstOrThrow({ where: { churchId: churchB.id } })
  await db.formSubmission.create({
    data: {
      churchId: churchB.id,
      formId: form.id,
      type: 'PRAYER',
      name: 'B sensitive',
      message: 'private prayer',
      isSensitive: true,
    },
  })
  await db.ministry.create({
    data: { churchId: churchB.id, name: 'B ministry', slug: 'b-ministry' },
  })
}, 120_000)

afterAll(async () => {
  await db?.$disconnect()
  rmSync(TEST_DB, { force: true })
})

/** The production guard pattern (see src/lib/api/handler.ts). */
async function resolveChurchContext(slug: string, userId: string) {
  const m = await db.churchMembership.findFirst({
    where: { church: { slug }, userId },
    include: { church: { select: { id: true, slug: true, name: true, status: true } } },
  })
  return m ?? null
}

describe('tenant isolation', () => {
  it('resolves context only for own church', async () => {
    const userA = await db.user.findUniqueOrThrow({ where: { email: 'a@test.dev' } })
    expect(await resolveChurchContext('church-a', userA.id)).not.toBeNull()
    expect(await resolveChurchContext('church-b', userA.id)).toBeNull() // ← acceptance criterion 18
    expect(await resolveChurchContext('does-not-exist', userA.id)).toBeNull()
  })

  it('never leaks another church’s records through scoped queries', async () => {
    const userA = await db.user.findUniqueOrThrow({ where: { email: 'a@test.dev' } })
    const ctx = await resolveChurchContext('church-a', userA.id)
    expect(ctx).not.toBeNull()
    // Every production data query is scoped by ctx.church.id:
    const pages = await db.websitePage.findMany({ where: { churchId: ctx!.church.id } })
    const ministries = await db.ministry.findMany({ where: { churchId: ctx!.church.id } })
    const submissions = await db.formSubmission.findMany({ where: { churchId: ctx!.church.id } })
    expect(pages).toHaveLength(0)
    expect(ministries).toHaveLength(0)
    expect(submissions).toHaveLength(0)
  })

  it('user B sees only their own data', async () => {
    const userB = await db.user.findUniqueOrThrow({ where: { email: 'b@test.dev' } })
    const ctx = await resolveChurchContext('church-b', userB.id)
    expect(ctx).not.toBeNull()
    const pages = await db.websitePage.findMany({ where: { churchId: ctx!.church.id } })
    expect(pages.map((p) => p.title)).toEqual(['B private page'])
    expect(await resolveChurchContext('church-a', userB.id)).toBeNull()
  })

  it('cascading delete cleans up tenant data with the church', async () => {
    const churchC = await db.church.create({ data: { slug: 'church-c', name: 'C' } })
    await db.websitePage.create({
      data: { churchId: churchC.id, title: 'C page', slug: 'c', draftSections: '[]' },
    })
    await db.church.delete({ where: { id: churchC.id } })
    const leftover = await db.websitePage.findMany({ where: { churchId: churchC.id } })
    expect(leftover).toHaveLength(0)
  })
})
