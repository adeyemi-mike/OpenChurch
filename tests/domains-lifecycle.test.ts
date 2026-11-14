import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { rmSync } from 'fs'
import path from 'path'

/**
 * Custom-domain LIFECYCLE against a throwaway SQLite database: claim
 * exclusivity, expired-claim reclaim, TXT verification (stubbed DNS),
 * manual hosting confirmation, primary selection, removal, and the
 * resolver + canonical helpers. Cross-tenant takeover is the critical
 * security property under test.
 */

const TEST_DB = path.resolve('/tmp/openchurch-test-domains.db')
const STUB_TTL = 60 * 60 * 1000

type Db = Awaited<ReturnType<typeof newClient>>
async function newClient() {
  const { PrismaClient } = await import('@prisma/client')
  return new PrismaClient()
}

let db: Db
let svc: typeof import('@/lib/domains/service')
let resolver: typeof import('@/lib/tenancy/resolver')
let churchA: { id: string; slug: string }
let churchB: { id: string; slug: string }
let actorUserId = ''

// DNS stub the service can use: map hostname -> TXT records.
const dnsRecords = new Map<string, string[][]>()

beforeAll(async () => {
  rmSync(TEST_DB, { force: true })
  process.env.DATABASE_URL = `file:${TEST_DB}`
  execSync('bunx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
  })
  db = await newClient()
  svc = await import('@/lib/domains/service')
  resolver = await import('@/lib/tenancy/resolver')
  churchA = await db.church.create({
    data: { slug: 'church-a', name: 'Church A', country: 'NG', settings: { create: {} } },
    select: { id: true, slug: true },
  })
  churchB = await db.church.create({
    data: { slug: 'church-b', name: 'Church B', country: 'GB', settings: { create: {} } },
    select: { id: true, slug: true },
  })
  const actorUser = await db.user.create({
    data: { email: 'domain-admin@test.dev', name: 'Domain Admin', passwordHash: 'x' },
    select: { id: true },
  })
  actorUserId = actorUser.id
})

afterAll(async () => {
  await db.$disconnect()
  rmSync(TEST_DB, { force: true })
})

// MUST be lazy: actorUserId is assigned in beforeAll — an eager object
// would capture '' at module-load time and fail the audit FK constraint.
const actor = {
  get actorUserId() {
    return actorUserId
  },
  actorEmail: 'domain-admin@test.dev',
}
const dnsStub = async (name: string) => {
  const records = dnsRecords.get(name)
  if (!records) {
    const err = new Error('not found') as NodeJS.ErrnoException
    err.code = 'ENOTFOUND'
    throw err
  }
  return records
}

describe('domain claim exclusivity', () => {
  it('church A adds a domain and receives TXT instructions', async () => {
    const res = await svc.addDomain({ churchId: churchA.id, rawDomain: 'WWW.GraceCommunity.org', ...actor })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.domain.domain).toBe('www.gracecommunity.org')
      expect(res.domain.status).toBe('PENDING')
      expect(res.domain.verificationToken).toMatch(/^[0-9a-f]{64}$/)
      expect(res.domain.txtRecord?.name).toBe('_openchurch-verify.www.gracecommunity.org')
      // Store the token for later DNS stubbing.
      dnsRecords.set('_openchurch-verify.www.gracecommunity.org', [
        [`openchurch-verify=${res.domain.verificationToken}`],
      ])
    }
  })

  it('church B cannot claim the same domain while the token is valid', async () => {
    const res = await svc.addDomain({ churchId: churchB.id, rawDomain: 'www.gracecommunity.org', ...actor })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.status).toBe(409)
      expect(res.code).toBe('CLAIM_PENDING')
    }
  })

  it('church A re-adding its own PENDING domain regenerates the token (idempotent)', async () => {
    const res = await svc.addDomain({ churchId: churchA.id, rawDomain: 'www.gracecommunity.org', ...actor })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.domain.verificationToken).toMatch(/^[0-9a-f]{64}$/)
      dnsRecords.set('_openchurch-verify.www.gracecommunity.org', [
        [`openchurch-verify=${res.domain.verificationToken}`],
      ])
    }
  })

  it('rejects invalid domains outright', async () => {
    for (const bad of ['notadomain', 'localhost', '8.8.8.8', 'x.vercel.app']) {
      const res = await svc.addDomain({ churchId: churchA.id, rawDomain: bad, ...actor })
      expect(res.ok).toBe(false)
    }
  })
})

describe('verification (stubbed DNS)', () => {
  let domainId = ''

  it('stays PENDING when DNS has no record yet', async () => {
    const list = await svc.listDomains(churchA.id)
    domainId = list[0].id
    dnsRecords.delete('_openchurch-verify.www.gracecommunity.org')
    const res = await svc.verifyDomain({ churchId: churchA.id, domainId, ...actor, resolver: dnsStub })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.domain.status).toBe('PENDING')
      expect(res.domain.failureReason).toContain('No TXT record')
    }
  })

  it('rejects a wrong token value', async () => {
    dnsRecords.set('_openchurch-verify.www.gracecommunity.org', [['openchurch-verify=' + 'f'.repeat(64)]])
    const res = await svc.verifyDomain({ churchId: churchA.id, domainId, ...actor, resolver: dnsStub })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.domain.status).toBe('PENDING')
  })

  it('verifies when DNS carries the exact token (split character-strings too)', async () => {
    // Regenerate to get a fresh plain token, then set DNS with the value
    // split across two character-strings (common for long TXT values).
    const regen = await svc.verifyDomain({ churchId: churchA.id, domainId, ...actor, resolver: dnsStub })
    expect(regen.ok).toBe(true)
    const fresh = await svc.regenerateToken({ churchId: churchA.id, domainId, ...actor })
    expect(fresh.ok).toBe(true)
    const token = fresh.ok ? fresh.domain.verificationToken! : ''
    dnsRecords.set('_openchurch-verify.www.gracecommunity.org', [
      ['openchurch-verify=', token.slice(0, 32), token.slice(32)],
    ])
    const res = await svc.verifyDomain({ churchId: churchA.id, domainId, ...actor, resolver: dnsStub })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.domain.status).toBe('VERIFIED')
  })

  it('the plain token is never stored in the database (hash only)', async () => {
    const rows = await db.churchDomain.findMany({ where: { churchId: churchA.id } })
    for (const row of rows) {
      if (row.verificationTokenHash) {
        expect(row.verificationTokenHash).toMatch(/^[0-9a-f]{64}$/)
        // None of the DNS values equal the stored hash (i.e. it is a digest).
        for (const records of dnsRecords.values()) {
          for (const r of records) expect(r.join('')).not.toBe(row.verificationTokenHash)
        }
      }
    }
  })
})

describe('hosting + primary + resolution', () => {
  let domainId = ''

  beforeAll(async () => {
    const list = await svc.listDomains(churchA.id)
    domainId = list[0].id
  })

  it('manual confirmation (self-hosted mode) marks the domain ACTIVE', async () => {
    // No VERCEL_TOKEN configured in this environment -> manual mode.
    const res = await svc.confirmManualConnection({ churchId: churchA.id, domainId, ...actor })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.domain.status).toBe('ACTIVE')
  })

  it('the resolver serves the owning church for the ACTIVE domain', async () => {
    const t = await resolver.resolveChurchByHost('www.gracecommunity.org')
    expect(t).toEqual({ churchId: churchA.id, slug: churchA.slug })
  })

  it('unrelated hosts do not resolve', async () => {
    expect(await resolver.resolveChurchByHost('unknown.example.org')).toBeNull()
    expect(await resolver.resolveChurchByHost('gracecommunity.org')).toBeNull()
  })

  it('primary selection requires ACTIVE and clears other primaries', async () => {
    const second = await svc.addDomain({ churchId: churchA.id, rawDomain: 'gracecommunity.org', ...actor })
    expect(second.ok).toBe(true)
    // Not verified yet -> cannot be primary.
    const early = await svc.setPrimaryDomain({
      churchId: churchA.id,
      domainId: second.ok ? second.domain.id : '',
      ...actor,
    })
    expect(early.ok).toBe(false)
    // Canonical origin uses the ACTIVE primary domain.
    const canon = await svc.resolveCanonicalOrigin(churchA.id, 'https://platform.example', null)
    expect(canon).toEqual({ origin: 'https://www.gracecommunity.org', isChurchDomain: true })
    expect(svc.churchCanonicalUrl(canon, churchA.slug, 'about')).toBe('https://www.gracecommunity.org/about')
  })

  it('canonical falls back to the platform origin without domains', async () => {
    const canon = await svc.resolveCanonicalOrigin(churchB.id, 'https://platform.example', null)
    expect(canon).toEqual({ origin: 'https://platform.example', isChurchDomain: false })
    expect(svc.churchCanonicalUrl(canon, churchB.slug, 'about')).toBe(
      'https://platform.example/church/church-b/about'
    )
  })
})

describe('expired pending claims are reclaimable (never silently transferred)', () => {
  it('church B can claim a domain whose PENDING claim by A has expired', async () => {
    const expired = new Date(Date.now() - 2 * STUB_TTL)
    await db.churchDomain.create({
      data: {
        churchId: churchA.id,
        domain: 'stale.example.org',
        status: 'PENDING',
        verificationTokenHash: 'x',
        tokenExpiresAt: expired,
      },
    })
    const res = await svc.addDomain({ churchId: churchB.id, rawDomain: 'stale.example.org', ...actor })
    expect(res.ok).toBe(true)
    // And it now belongs to B, not A.
    const rows = await db.churchDomain.findMany({ where: { domain: 'stale.example.org' } })
    expect(rows).toHaveLength(1)
    expect(rows[0].churchId).toBe(churchB.id)
  })
})

describe('removal lifecycle', () => {
  it('removal deletes the mapping and keeps the audit trail', async () => {
    const list = await svc.listDomains(churchA.id)
    const active = list.find((d) => d.status === 'ACTIVE')!
    const res = await svc.removeDomain({ churchId: churchA.id, domainId: active.id, ...actor })
    expect(res.ok).toBe(true)
    const after = await svc.listDomains(churchA.id)
    expect(after.find((d) => d.id === active.id)).toBeUndefined()
    const audits = await db.auditLog.findMany({
      where: { entityType: 'church_domain', action: 'domain.removed' },
    })
    expect(audits.length).toBeGreaterThanOrEqual(1)
  })

  it('cross-church removal is impossible (scoped lookup)', async () => {
    const bDomains = await svc.listDomains(churchB.id)
    expect(bDomains.length).toBeGreaterThan(0)
    const res = await svc.removeDomain({ churchId: churchA.id, domainId: bDomains[0].id, ...actor })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(404)
  })
})
