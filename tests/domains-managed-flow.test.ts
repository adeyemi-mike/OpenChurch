import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { rmSync } from 'fs'
import path from 'path'

/**
 * MANAGED-HOSTING custom-domain workflow against a throwaway SQLite DB,
 * with a provider double standing in for the Vercel API and a stubbed DNS
 * resolver + HTTPS probe. This is the end-to-end lifecycle two independent
 * churches go through:
 *
 *   add → TXT verify → connect (PENDING_DNS) → recheck (PENDING_SSL) →
 *   recheck (ACTIVE, SSL confirmed) → primary selection → www/apex redirect
 *   → cross-tenant claim prevention → provider failure & retry →
 *   provider losing the domain (downgrade) → recovery.
 *
 * TRUTH RULES under test: no status ever turns green unless the provider
 * (or the HTTPS probe) actually confirmed it; a provider that lost the
 * domain downgrades ACTIVE → FAILED.
 */

const TEST_DB = path.resolve('/tmp/openchurch-test-managed-domains.db')
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

// ---------------------------------------------------------------------------
// Doubles: DNS TXT stub, HTTPS probe stub, provider (Vercel-shaped) double
// ---------------------------------------------------------------------------

const dnsRecords = new Map<string, string[][]>()
const dnsStub = async (name: string) => {
  const records = dnsRecords.get(name)
  if (!records) {
    const err = new Error('not found') as NodeJS.ErrnoException
    err.code = 'ENOTFOUND'
    throw err
  }
  return records
}

let probeShouldSucceed = false
const probeStub = async () => (probeShouldSucceed ? { ok: true as const } : { ok: false as const, reason: 'HTTPS is not reachable on this domain yet.' })

type ProviderScript = {
  addResult?: { ok: true; providerRef?: string | null } | { ok: false; error: string }
  inspect: () => {
    assigned: boolean
    missing?: boolean
    dnsConfigured: boolean | null
    error: string | null
    records: { type: string; name: string; value: string }[]
  }
}

let providerScript: ProviderScript

const providerDouble = {
  kind: 'vercel' as const,
  automated: true,
  configured: true,
  async addDomain(domain: string) {
    if (providerScript.addResult && !providerScript.addResult.ok) return providerScript.addResult
    if (providerScript.addResult?.ok) return providerScript.addResult
    addedDomains.add(domain)
    return { ok: true as const, providerRef: `uid-${domain}` }
  },
  async removeDomain(domain: string) {
    addedDomains.delete(domain)
    return { ok: true as const }
  },
  async inspectDomain(domain: string) {
    if (!addedDomains.has(domain)) {
      return {
        assigned: false,
        missing: true,
        dnsConfigured: null,
        error: 'The domain is not attached to the Vercel project.',
        requiredRecords: [],
        providerRef: null,
        raw: { status: 404 },
      }
    }
    const s = providerScript.inspect()
    return {
      assigned: s.assigned,
      missing: s.missing ?? false,
      dnsConfigured: s.dnsConfigured,
      error: s.error,
      requiredRecords: s.records.map((r) => ({ ...r, note: 'Set at your DNS provider.' })),
      providerRef: `uid-${domain}`,
      raw: { status: 200 },
    }
  },
}
const addedDomains = new Set<string>()

const actor = {
  get actorUserId() {
    return actorUserId
  },
  actorEmail: 'managed-admin@test.dev',
}

beforeAll(async () => {
  rmSync(TEST_DB, { force: true })
  process.env.DATABASE_URL = `file:${TEST_DB}`
  // Managed-hosting capability: provider tokens present (the service uses
  // the injected provider double, never the network).
  process.env.VERCEL_TOKEN = 'test-token'
  process.env.VERCEL_PROJECT_ID = 'test-project'
  delete process.env.CUSTOM_DOMAIN_MODE
  execSync('bunx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
  })
  db = await newClient()
  svc = await import('@/lib/domains/service')
  resolver = await import('@/lib/tenancy/resolver')
  churchA = await db.church.create({
    data: { slug: 'cac-parakin', name: 'CAC Parakin', country: 'NG', plan: 'premium', settings: { create: {} } },
    select: { id: true, slug: true },
  })
  churchB = await db.church.create({
    data: { slug: 'emmanuel-parish', name: 'Emmanuel Parish', country: 'NG', plan: 'premium', settings: { create: {} } },
    select: { id: true, slug: true },
  })
  const user = await db.user.create({
    data: { email: 'managed-admin@test.dev', name: 'Managed Admin', passwordHash: 'x' },
    select: { id: true },
  })
  actorUserId = user.id

  providerScript = {
    inspect: () => ({ assigned: false, dnsConfigured: null, error: 'Waiting for DNS records.', records: [] }),
  }
})

afterAll(async () => {
  await db?.$disconnect()
  rmSync(TEST_DB, { force: true })
  delete process.env.VERCEL_TOKEN
  delete process.env.VERCEL_PROJECT_ID
})

// ---------------------------------------------------------------------------
// Church A: the full happy path
// ---------------------------------------------------------------------------

describe('church A: add → verify → connect → DNS → SSL → ACTIVE', () => {
  let domainId = ''
  let token = ''

  it('adds the domain and receives TXT instructions + the apex companion suggestion', async () => {
    const res = await svc.addDomain({ churchId: churchA.id, rawDomain: 'www.cacparakin.org', ...actor })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.domain.status).toBe('PENDING')
      expect(res.domain.verificationToken).toMatch(/^[0-9a-f]{64}$/)
      expect(res.companionSuggestion).toBe('cacparakin.org')
      token = res.domain.verificationToken!
      domainId = res.domain.id
      dnsRecords.set('_openchurch-verify.www.cacparakin.org', [[`openchurch-verify=${token}`]])
    }
  })

  it('verifies ownership from the DNS TXT record', async () => {
    const res = await svc.verifyDomain({ churchId: churchA.id, domainId, ...actor, resolver: dnsStub })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.domain.status).toBe('VERIFIED')
  })

  it('connect attaches the domain; DNS not yet confirmed → PENDING_DNS with the provider records', async () => {
    providerScript.inspect = () => ({
      assigned: false,
      dnsConfigured: null,
      error: 'Pending domain propagation',
      records: [
        { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' },
        { type: 'TXT', name: '_vercel', value: 'vc-domain-verify=xyz' },
      ],
    })
    const res = await svc.connectDomain({ churchId: churchA.id, domainId, ...actor, provider: providerDouble, probe: probeStub })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.domain.status).toBe('PENDING_DNS')
      expect(res.domain.dnsStatus).toBe('PENDING')
      expect(res.domain.providerRef).toBe('uid-www.cacparakin.org')
      expect(res.domain.providerInfo?.requiredRecords.map((r) => r.type)).toEqual(['CNAME', 'TXT'])
    }
    // PENDING_DNS never resolves.
    expect(await resolver.resolveChurchByHost('www.cacparakin.org')).toBeNull()
  })

  it('recheck after DNS is set (provider confirms, HTTPS not live yet) → PENDING_SSL', async () => {
    providerScript.inspect = () => ({
      assigned: true,
      dnsConfigured: true,
      error: null,
      records: [{ type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' }],
    })
    probeShouldSucceed = false
    const res = await svc.recheckDomain({ churchId: churchA.id, domainId, ...actor, provider: providerDouble, probe: probeStub })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.domain.status).toBe('PENDING_SSL')
      expect(res.domain.dnsStatus).toBe('OK')
      expect(res.domain.sslStatus).toBe('PROVISIONING')
      expect(res.domain.failureReason).toContain('SSL')
    }
    expect(await resolver.resolveChurchByHost('www.cacparakin.org')).toBeNull()
  })

  it('recheck once HTTPS answers → ACTIVE with SSL confirmed (no fabricated green before this)', async () => {
    probeShouldSucceed = true
    const res = await svc.recheckDomain({ churchId: churchA.id, domainId, ...actor, provider: providerDouble, probe: probeStub })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.domain.status).toBe('ACTIVE')
      expect(res.domain.sslStatus).toBe('ACTIVE')
      expect(res.domain.failureReason).toBeNull()
    }
  })

  it('the resolver now serves church A on the custom domain', async () => {
    const t = await resolver.resolveChurchByHost('www.cacparakin.org')
    expect(t).toMatchObject({ churchId: churchA.id, slug: churchA.slug, domain: 'www.cacparakin.org' })
  })

  it('becomes the primary domain (canonical URLs follow it)', async () => {
    const res = await svc.setPrimaryDomain({ churchId: churchA.id, domainId, ...actor })
    expect(res.ok).toBe(true)
    const canon = await svc.resolveCanonicalOrigin(churchA.id, 'https://platform.example', null)
    expect(canon).toEqual({ origin: 'https://www.cacparakin.org', isChurchDomain: true })
  })
})

// ---------------------------------------------------------------------------
// www ↔ apex relationship + tenant isolation
// ---------------------------------------------------------------------------

describe('www ↔ apex relationship and tenant isolation', () => {
  let apexId = ''

  it('adding the apex domain suggests the www companion (already connected → no suggestion)', async () => {
    const res = await svc.addDomain({ churchId: churchA.id, rawDomain: 'cacparakin.org', ...actor })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.companionSuggestion).toBeUndefined() // www already belongs to church A
      apexId = res.domain.id
      dnsRecords.set('_openchurch-verify.cacparakin.org', [[`openchurch-verify=${res.domain.verificationToken}`]])
    }
  })

  it('church B cannot claim church A’s ACTIVE domain', async () => {
    const res = await svc.addDomain({ churchId: churchB.id, rawDomain: 'www.cacparakin.org', ...actor })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.status).toBe(409)
      expect(res.code).toBe('DOMAIN_TAKEN')
    }
  })

  it('church B cannot verify, connect, recheck or remove church A’s domain (scoped lookups)', async () => {
    const list = await svc.listDomains(churchA.id)
    const target = list.find((d) => d.domain === 'www.cacparakin.org')!
    for (const fn of [
      () => svc.verifyDomain({ churchId: churchB.id, domainId: target.id, ...actor, resolver: dnsStub }),
      () => svc.connectDomain({ churchId: churchB.id, domainId: target.id, ...actor, provider: providerDouble, probe: probeStub }),
      () => svc.recheckDomain({ churchId: churchB.id, domainId: target.id, ...actor, provider: providerDouble, probe: probeStub }),
      () => svc.setPrimaryDomain({ churchId: churchB.id, domainId: target.id, ...actor }),
      () => svc.removeDomain({ churchId: churchB.id, domainId: target.id, ...actor, provider: providerDouble }),
    ]) {
      const res = await fn()
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.status).toBe(404)
    }
  })

  it('verifies + connects the apex domain and makes it ACTIVE; non-primary apex redirects to the www primary', async () => {
    // verify
    let res = await svc.verifyDomain({ churchId: churchA.id, domainId: apexId, ...actor, resolver: dnsStub })
    expect(res.ok).toBe(true)
    // connect (apex: provider reports the A record)
    providerScript.inspect = () => ({
      assigned: true,
      dnsConfigured: true,
      error: null,
      records: [{ type: 'A', name: '@', value: '76.76.21.21' }],
    })
    probeShouldSucceed = true
    res = await svc.connectDomain({ churchId: churchA.id, domainId: apexId, ...actor, provider: providerDouble, probe: probeStub })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.domain.status).toBe('ACTIVE')

    // The apex resolves to church A but is NOT the primary → the proxy
    // redirects it to the www primary (canonical-host enforcement).
    const t = await resolver.resolveChurchByHost('cacparakin.org')
    expect(t).toMatchObject({ churchId: churchA.id, slug: churchA.slug, domain: 'cacparakin.org', isPrimaryDomain: false, primaryDomain: 'www.cacparakin.org' })
    const { canonicalRedirectFor } = await import('@/lib/tenancy/resolver')
    expect(canonicalRedirectFor(t!, '/about', '')).toBe('https://www.cacparakin.org/about')
  })
})

// ---------------------------------------------------------------------------
// Church B: an independent church with its own domain
// ---------------------------------------------------------------------------

describe('church B: an independent tenant on the same deployment', () => {
  it('adds, verifies and activates its own domain without touching church A', async () => {
    const add = await svc.addDomain({ churchId: churchB.id, rawDomain: 'www.emmanuelparish.org', ...actor })
    expect(add.ok).toBe(true)
    if (!add.ok) return
    dnsRecords.set('_openchurch-verify.www.emmanuelparish.org', [[`openchurch-verify=${add.domain.verificationToken}`]])
    const verify = await svc.verifyDomain({ churchId: churchB.id, domainId: add.domain.id, ...actor, resolver: dnsStub })
    expect(verify.ok).toBe(true)
    const connect = await svc.connectDomain({ churchId: churchB.id, domainId: add.domain.id, ...actor, provider: providerDouble, probe: probeStub })
    expect(connect.ok).toBe(true)
    if (connect.ok) expect(connect.domain.status).toBe('ACTIVE')

    // Both churches resolve on their own domains — no cross-contamination.
    expect(await resolver.resolveChurchByHost('www.cacparakin.org')).toMatchObject({ churchId: churchA.id })
    expect(await resolver.resolveChurchByHost('www.emmanuelparish.org')).toMatchObject({ churchId: churchB.id })
  })
})

// ---------------------------------------------------------------------------
// Provider failures, retries and downgrades — the truth rules
// ---------------------------------------------------------------------------

describe('provider failures, retries and downgrades', () => {
  it('a failed provider add surfaces PROVIDER_ERROR and leaves the row VERIFIED (no fake state)', async () => {
    const add = await svc.addDomain({ churchId: churchB.id, rawDomain: 'retry.emmanuelparish.org', ...actor })
    expect(add.ok).toBe(true)
    if (!add.ok) return
    dnsRecords.set('_openchurch-verify.retry.emmanuelparish.org', [[`openchurch-verify=${add.domain.verificationToken}`]])
    await svc.verifyDomain({ churchId: churchB.id, domainId: add.domain.id, ...actor, resolver: dnsStub })

    providerScript.addResult = { ok: false, error: 'Vercel could not add the domain (HTTP 500).' }
    providerScript.inspect = () => ({ assigned: false, dnsConfigured: null, error: 'x', records: [] })
    const connect = await svc.connectDomain({ churchId: churchB.id, domainId: add.domain.id, ...actor, provider: providerDouble, probe: probeStub })
    expect(connect.ok).toBe(false)
    if (!connect.ok) {
      expect(connect.status).toBe(502)
      expect(connect.code).toBe('PROVIDER_ERROR')
    }
    const list = await svc.listDomains(churchB.id)
    const row = list.find((d) => d.domain === 'retry.emmanuelparish.org')!
    expect(row.status).toBe('VERIFIED')
    expect(row.failureReason).toContain('HTTP 500')

    // Retry after the provider recovers → succeeds.
    providerScript.addResult = undefined
    providerScript.inspect = () => ({ assigned: true, dnsConfigured: true, error: null, records: [] })
    probeShouldSucceed = true
    const retry = await svc.connectDomain({ churchId: churchB.id, domainId: add.domain.id, ...actor, provider: providerDouble, probe: probeStub })
    expect(retry.ok).toBe(true)
    if (retry.ok) expect(retry.domain.status).toBe('ACTIVE')
  })

  it('the provider LOSING an ACTIVE domain downgrades it to FAILED (never a misleading active record)', async () => {
    const list = await svc.listDomains(churchB.id)
    const row = list.find((d) => d.domain === 'retry.emmanuelparish.org')!
    expect(row.status).toBe('ACTIVE')

    // The provider externally removed the domain (404 at the API).
    addedDomains.delete('retry.emmanuelparish.org')
    const res = await svc.recheckDomain({ churchId: churchB.id, domainId: row.id, ...actor, provider: providerDouble, probe: probeStub })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.domain.status).toBe('FAILED')
      expect(res.domain.failureReason).toContain('no longer')
    }
    // FAILED domains stop resolving immediately.
    expect(await resolver.resolveChurchByHost('retry.emmanuelparish.org')).toBeNull()

    // ...and the church can recover it via a connect retry.
    providerScript.inspect = () => ({ assigned: true, dnsConfigured: true, error: null, records: [] })
    probeShouldSucceed = true
    const recover = await svc.connectDomain({ churchId: churchB.id, domainId: row.id, ...actor, provider: providerDouble, probe: probeStub })
    expect(recover.ok).toBe(true)
    if (recover.ok) expect(recover.domain.status).toBe('ACTIVE')
  })

  it('recheck refuses rows that were never provider-assigned (NOT_CONNECTED)', async () => {
    const add = await svc.addDomain({ churchId: churchB.id, rawDomain: 'never-connected.example.org', ...actor })
    expect(add.ok).toBe(true)
    if (!add.ok) return
    const res = await svc.recheckDomain({ churchId: churchB.id, domainId: add.domain.id, ...actor, provider: providerDouble, probe: probeStub })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('NOT_CONNECTED')
  })
})

// ---------------------------------------------------------------------------
// Operator suspension
// ---------------------------------------------------------------------------

describe('operator suspension (platform kill-switch)', () => {
  it('resume restores the EXACT pre-suspension status (never upgrades verification)', async () => {
    // Regression: a row suspended while VERIFICATION_FAILED must resume as
    // VERIFICATION_FAILED — never as VERIFIED (that would fabricate ownership).
    const add = await svc.addDomain({ churchId: churchA.id, rawDomain: 'unverified-suspend.example.org', ...actor })
    expect(add.ok).toBe(true)
    if (!add.ok) return
    // No DNS record → verification fails.
    const verify = await svc.verifyDomain({ churchId: churchA.id, domainId: add.domain.id, ...actor, resolver: dnsStub })
    expect(verify.ok).toBe(true)
    if (verify.ok) expect(verify.domain.status).toBe('VERIFICATION_FAILED')

    const suspend = await svc.setDomainSuspension({ domainId: add.domain.id, suspended: true, actorUserId, actorEmail: 'operator@test.dev' })
    expect(suspend.ok).toBe(true)
    if (suspend.ok) expect(suspend.domain.status).toBe('SUSPENDED')

    const resume = await svc.setDomainSuspension({ domainId: add.domain.id, suspended: false, actorUserId, actorEmail: 'operator@test.dev' })
    expect(resume.ok).toBe(true)
    if (resume.ok) expect(resume.domain.status).toBe('VERIFICATION_FAILED')
  })

  it('suspends an ACTIVE domain → stops resolving; resume restores it', async () => {
    const list = await svc.listDomains(churchA.id)
    const row = list.find((d) => d.domain === 'www.cacparakin.org')!
    expect(row.status).toBe('ACTIVE')

    const suspend = await svc.setDomainSuspension({
      domainId: row.id,
      suspended: true,
      actorUserId,
      actorEmail: 'operator@test.dev',
    })
    expect(suspend.ok).toBe(true)
    if (suspend.ok) expect(suspend.domain.status).toBe('SUSPENDED')
    expect(await resolver.resolveChurchByHost('www.cacparakin.org')).toBeNull()

    const resume = await svc.setDomainSuspension({
      domainId: row.id,
      suspended: false,
      actorUserId,
      actorEmail: 'operator@test.dev',
    })
    expect(resume.ok).toBe(true)
    if (resume.ok) expect(resume.domain.status).toBe('ACTIVE')
    expect(await resolver.resolveChurchByHost('www.cacparakin.org')).toMatchObject({ churchId: churchA.id })
  })
})

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

describe('audit trail', () => {
  it('every domain operation is audited', async () => {
    const actions = await db.auditLog.findMany({
      where: { entityType: 'church_domain' },
      select: { action: true },
    })
    const seen = new Set(actions.map((a) => a.action))
    for (const expected of [
      'domain.added',
      'domain.verified',
      'domain.connected',
      'domain.rechecked',
      'domain.primaryChanged',
      'domain.suspended',
      'domain.resumed',
    ]) {
      expect(seen.has(expected)).toBe(true)
    }
  })
})
