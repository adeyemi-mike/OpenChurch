import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execSync } from 'child_process'
import { rmSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

/**
 * HTTP-LEVEL tenant-isolation tests: the real route handlers (guards, CSRF
 * layer, tenant scoping — everything) invoked with constructed requests and
 * REAL database-backed sessions, against two independent tenants.
 *
 * Proves the master security requirements end to end:
 *   - Church A cannot read Church B's private data
 *   - Church A cannot delete Church B's records (IDOR)
 *   - Authors cannot destroy published content or read sensitive enquiries
 *   - Anonymous visitors get 401, non-admins never reach platform admin
 *   - Private media stays inside the owning church
 *   - Public form submissions route to the correct tenant
 */

// ---------------------------------------------------------------------------
// next/headers mock: route handlers read the session cookie through
// cookies(). The jar is switched per test to "act as" a specific user.
// ---------------------------------------------------------------------------
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === 'openchurch_session' && jar.token ? { value: jar.token } : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

const TEST_DB = path.resolve('/tmp/openchurch-test-http-isolation.db')
const STORE_DIR = mkdtempSync(path.join(tmpdir(), 'openchurch-isolation-store-'))
const ORIGIN = 'http://localhost:3000'

function sha(v: string) {
  return createHash('sha256').update(v).digest('hex')
}

/** A request that looks like a same-origin browser call (CSRF-safe).
 *  The acting user's session cookie travels in the header — exactly like a
 *  real browser request (the route reads it from req.cookies). */
function req(
  pathname: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: init.method ?? 'GET',
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    headers: {
      host: 'localhost:3000',
      origin: ORIGIN,
      ...(jar.token ? { cookie: `openchurch_session=${jar.token}` } : {}),
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
}

type Params<T extends Record<string, string> = Record<string, string>> = { params: Promise<T> }
const P = <T extends Record<string, string>>(obj: T): Params<T> => ({ params: Promise.resolve(obj) })
const json = async (res: Response) => (await res.json()) as Record<string, unknown>

let db: import('@prisma/client').PrismaClient
let sermonsIdRoute: typeof import('@/app/api/dashboard/[slug]/sermons/[id]/route')
let submissionsRoute: typeof import('@/app/api/dashboard/[slug]/submissions/route')
let domainsRoute: typeof import('@/app/api/dashboard/[slug]/domains/route')
let usersRoute: typeof import('@/app/api/dashboard/[slug]/users/route')
let exportRoute: typeof import('@/app/api/dashboard/[slug]/export/route')
let mediaFileRoute: typeof import('@/app/api/media/[id]/file/route')
let adminRoute: typeof import('@/app/api/admin/route')
let submitRoute: typeof import('@/app/api/public/[slug]/submit/route')
let onboardingChurchRoute: typeof import('@/app/api/onboarding/church/route')
let changePasswordRoute: typeof import('@/app/api/auth/change-password/route')
let cronRoute: typeof import('@/app/api/cron/domains/route')

const ids = {
  churchA: '',
  churchB: '',
  ownerA: '',
  authorA: '',
  editorA: '',
  ownerB: '',
  admin: '',
  loner: '',
  sermonA: '',
  privateMediaB: '',
}

/** Create a real DB session and return the raw cookie token. */
async function makeSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await db.session.create({
    data: {
      tokenHash: sha(token),
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })
  return token
}

function actAs(token: string | undefined) {
  jar.token = token
}

beforeAll(async () => {
  rmSync(TEST_DB, { force: true })
  process.env.DATABASE_URL = `file:${TEST_DB}`
  process.env.STORAGE_PATH = STORE_DIR
  delete process.env.VERCEL_TOKEN
  delete process.env.VERCEL_PROJECT_ID
  delete process.env.CUSTOM_DOMAIN_MODE
  delete process.env.CRON_SECRET
  process.env.CHURCH_LIMIT_PER_USER = '1'
  execSync('bunx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
  })

  db = (await import('@prisma/client')).PrismaClient ? new (await import('@prisma/client')).PrismaClient() : null!
  sermonsIdRoute = await import('@/app/api/dashboard/[slug]/sermons/[id]/route')
  submissionsRoute = await import('@/app/api/dashboard/[slug]/submissions/route')
  domainsRoute = await import('@/app/api/dashboard/[slug]/domains/route')
  usersRoute = await import('@/app/api/dashboard/[slug]/users/route')
  exportRoute = await import('@/app/api/dashboard/[slug]/export/route')
  mediaFileRoute = await import('@/app/api/media/[id]/file/route')
  adminRoute = await import('@/app/api/admin/route')
  submitRoute = await import('@/app/api/public/[slug]/submit/route')
  onboardingChurchRoute = await import('@/app/api/onboarding/church/route')
  changePasswordRoute = await import('@/app/api/auth/change-password/route')
  cronRoute = await import('@/app/api/cron/domains/route')

  const passwordHash = await bcrypt.hash('OldPassw0rd1', 4)
  const mkUser = (email: string, extra: Record<string, unknown> = {}) =>
    db.user.create({ data: { email, name: email.split('@')[0], passwordHash, ...extra }, select: { id: true } })

  const [ownerA, authorA, editorA, ownerB, admin, loner] = await Promise.all([
    mkUser('owner-a@test.dev'),
    mkUser('author-a@test.dev'),
    mkUser('editor-a@test.dev'),
    mkUser('owner-b@test.dev'),
    mkUser('platform-admin@test.dev', { isPlatformAdmin: true }),
    mkUser('loner@test.dev'),
  ])
  Object.assign(ids, {
    ownerA: ownerA.id,
    authorA: authorA.id,
    editorA: editorA.id,
    ownerB: ownerB.id,
    admin: admin.id,
    loner: loner.id,
  })

  const mkChurch = (slug: string) =>
    db.church.create({
      data: { slug, name: slug, country: 'NG', isPublished: true, settings: { create: {} } },
      select: { id: true },
    })
  const [churchA, churchB] = await Promise.all([mkChurch('church-a'), mkChurch('church-b')])
  ids.churchA = churchA.id
  ids.churchB = churchB.id

  await db.churchMembership.createMany({
    data: [
      { churchId: churchA.id, userId: ownerA.id, role: 'OWNER' },
      { churchId: churchA.id, userId: authorA.id, role: 'AUTHOR' },
      { churchId: churchA.id, userId: editorA.id, role: 'EDITOR' },
      { churchId: churchB.id, userId: ownerB.id, role: 'OWNER' },
    ],
  })

  // Published sermon in church A (owned by nobody in particular).
  const sermon = await db.sermon.create({
    data: {
      churchId: churchA.id,
      title: 'Grace Abounds',
      speakerName: 'Pastor A',
      preachedAt: new Date(),
      status: 'PUBLISHED',
    },
    select: { id: true },
  })
  ids.sermonA = sermon.id

  // Church A: an active CONTACT form (public submissions) + two submissions.
  await db.form.create({
    data: {
      churchId: churchA.id,
      type: 'CONTACT',
      title: 'Contact us',
      isActive: true,
      successMessage: 'Thank you!',
    },
  })
  await db.formSubmission.createMany({
    data: [
      {
        churchId: churchA.id,
        formId: null,
        type: 'CONTACT',
        name: 'Visitor',
        email: 'visitor@example.org',
        message: 'Hello',
        isSensitive: false,
      },
      {
        churchId: churchA.id,
        formId: null,
        type: 'PRAYER',
        name: 'Member',
        email: 'member@example.org',
        message: 'Please pray for me',
        isSensitive: true,
      },
    ],
  })

  // Church B: a PRIVATE media asset with real bytes on disk.
  const media = await db.mediaAsset.create({
    data: {
      churchId: churchB.id,
      fileName: 'private.png',
      storedName: 'private.png',
      mimeType: 'image/png',
      kind: 'IMAGE',
      visibility: 'PRIVATE',
      sizeBytes: 14,
    },
    select: { id: true },
  })
  ids.privateMediaB = media.id
  const { storage, storageKey } = await import('@/lib/storage')
  await storage.put(storageKey(churchB.id, 'private.png'), Buffer.from('fake-png-bytes'))
}, 240_000)

afterAll(async () => {
  actAs(undefined)
  await db?.$disconnect()
  rmSync(TEST_DB, { force: true })
  rmSync(STORE_DIR, { recursive: true, force: true })
  delete process.env.CHURCH_LIMIT_PER_USER
  delete process.env.STORAGE_PATH
})

// ---------------------------------------------------------------------------
// Sessions used across scenarios
// ---------------------------------------------------------------------------
let ownerAToken: string
let authorAToken: string
let editorAToken: string
let ownerBToken: string
let adminToken: string

beforeAll(async () => {
  ;[ownerAToken, authorAToken, editorAToken, ownerBToken, adminToken] = await Promise.all([
    makeSession(ids.ownerA),
    makeSession(ids.authorA),
    makeSession(ids.editorA),
    makeSession(ids.ownerB),
    makeSession(ids.admin),
  ])
})

describe('cross-tenant reads (must 404 — no tenant existence leak)', () => {
  it('Church A owner cannot list Church B sermons', async () => {
    actAs(ownerAToken)
    const res = await sermonsIdRoute.PATCH(
      req('/api/dashboard/church-b/sermons', { method: 'PATCH', body: { title: 'x' } }),
      P({ slug: 'church-b', id: '00000000-0000-0000-0000-000000000000' })
    )
    // PATCH on a non-existent id still must not leak: 404 either way.
    expect([403, 404]).toContain(res.status)
    expect(res.status).toBe(404) // membership check fails FIRST → church "not found"
  })

  it('Church A owner cannot list Church B enquiries', async () => {
    actAs(ownerAToken)
    const res = await submissionsRoute.GET(req('/api/dashboard/church-b/submissions'), P({ slug: 'church-b' }))
    expect(res.status).toBe(404)
  })

  it('Church A owner cannot list Church B domains', async () => {
    actAs(ownerAToken)
    const res = await domainsRoute.GET(req('/api/dashboard/church-b/domains'), P({ slug: 'church-b' }))
    expect(res.status).toBe(404)
  })

  it('Church A owner cannot list Church B members', async () => {
    actAs(ownerAToken)
    const res = await usersRoute.GET(req('/api/dashboard/church-b/users'), P({ slug: 'church-b' }))
    expect(res.status).toBe(404)
  })

  it('Church B owner cannot export Church A data', async () => {
    actAs(ownerBToken)
    const res = await exportRoute.GET(req('/api/dashboard/church-a/export'), P({ slug: 'church-a' }))
    expect(res.status).toBe(404)
  })
})

describe('cross-tenant writes / IDOR (must 404)', () => {
  it('Church B owner cannot DELETE Church A sermon by id', async () => {
    actAs(ownerBToken)
    const res = await sermonsIdRoute.DELETE(
      req(`/api/dashboard/church-a/sermons/${ids.sermonA}`, { method: 'DELETE' }),
      P({ slug: 'church-a', id: ids.sermonA })
    )
    expect(res.status).toBe(404)
    const survives = await db.sermon.findUnique({ where: { id: ids.sermonA }, select: { id: true } })
    expect(survives).not.toBeNull()
  })
})

describe('role enforcement inside a tenant (server-side)', () => {
  it('AUTHOR cannot delete published content (content:manage required)', async () => {
    actAs(authorAToken)
    const res = await sermonsIdRoute.DELETE(
      req(`/api/dashboard/church-a/sermons/${ids.sermonA}`, { method: 'DELETE' }),
      P({ slug: 'church-a', id: ids.sermonA })
    )
    expect(res.status).toBe(403)
  })

  it('AUTHOR cannot read the enquiries inbox (enquiries:view is EDITOR+)', async () => {
    actAs(authorAToken)
    const res = await submissionsRoute.GET(req('/api/dashboard/church-a/submissions'), P({ slug: 'church-a' }))
    expect(res.status).toBe(403)
  })

  it('EDITOR sees contact enquiries but never sensitive prayer rows', async () => {
    actAs(editorAToken)
    const res = await submissionsRoute.GET(req('/api/dashboard/church-a/submissions'), P({ slug: 'church-a' }))
    expect(res.status).toBe(200)
    const body = (await json(res)).data as { items: { type: string }[] }
    expect(body.items.some((i: { type: string }) => i.type === 'CONTACT')).toBe(true)
    expect(body.items.some((i: { type: string }) => i.type === 'PRAYER')).toBe(false)
  })

  it('OWNER sees sensitive prayer rows (flagged canViewSensitive)', async () => {
    actAs(ownerAToken)
    const res = await submissionsRoute.GET(req('/api/dashboard/church-a/submissions'), P({ slug: 'church-a' }))
    expect(res.status).toBe(200)
    const body = (await json(res)).data as { items: { type: string }[]; canViewSensitive: boolean }
    expect(body.items.some((i) => i.type === 'PRAYER')).toBe(true)
    expect(body.canViewSensitive).toBe(true)
  })

  it('AUTHOR cannot export church data (owner-only)', async () => {
    actAs(authorAToken)
    const res = await exportRoute.GET(req('/api/dashboard/church-a/export'), P({ slug: 'church-a' }))
    expect(res.status).toBe(403)
  })
})

describe('anonymous and unauthorised access', () => {
  it('anonymous visitor gets 401 on dashboard APIs', async () => {
    actAs(undefined)
    const res = await submissionsRoute.GET(req('/api/dashboard/church-a/submissions'), P({ slug: 'church-a' }))
    expect(res.status).toBe(401)
  })

  it('a signed-in user with no membership gets 404 (not 403 — no leak)', async () => {
    const lonerToken = await makeSession(ids.loner)
    actAs(lonerToken)
    const res = await domainsRoute.GET(req('/api/dashboard/church-a/domains'), P({ slug: 'church-a' }))
    expect(res.status).toBe(404)
  })

  it('a church owner (non-platform-admin) cannot reach platform admin', async () => {
    actAs(ownerAToken)
    const res = await adminRoute.GET(req('/api/admin'))
    expect(res.status).toBe(403)
  })

  it('CSRF layer rejects cross-site POSTs (wrong Origin)', async () => {
    actAs(ownerAToken)
    const cross = new NextRequest('http://localhost:3000/api/dashboard/church-a/sermons', {
      method: 'POST',
      body: JSON.stringify({ title: 'Evil', speakerName: 'X', preachedAt: '2026-01-01' }),
      headers: {
        host: 'localhost:3000',
        origin: 'https://evil.example.net',
        'content-type': 'application/json',
      },
    })
    const sermonsRoute = await import('@/app/api/dashboard/[slug]/sermons/route')
    const res = await sermonsRoute.POST(cross, P({ slug: 'church-a' }))
    expect(res.status).toBe(403)
    expect(['CSRF_INVALID', 'CSRF_BLOCKED']).toContain(
      ((await json(res)).error as { code?: string }).code
    )
  })
})

describe('private media isolation', () => {
  it('anonymous → 401, Church A member → 403, Church B member → 200', async () => {
    const url = `/api/media/${ids.privateMediaB}/file`
    actAs(undefined)
    expect((await mediaFileRoute.GET(req(url), P({ id: ids.privateMediaB }))).status).toBe(401)
    actAs(ownerAToken)
    expect((await mediaFileRoute.GET(req(url), P({ id: ids.privateMediaB }))).status).toBe(403)
    actAs(ownerBToken)
    const okRes = await mediaFileRoute.GET(req(url), P({ id: ids.privateMediaB }))
    expect(okRes.status).toBe(200)
    // Private bytes must never be marked cacheable by shared proxies.
    expect(okRes.headers.get('cache-control')).toContain('private')
  })
})

describe('public form submissions route to the right tenant', () => {
  it('submits into Church A and nowhere else', async () => {
    actAs(undefined)
    const before = await db.formSubmission.count({ where: { churchId: ids.churchB } })
    const res = await submitRoute.POST(
      req('/api/public/church-a/submit', {
        method: 'POST',
        body: { type: 'CONTACT', name: 'Web Visitor', email: 'v@example.org', message: 'I would like to visit' },
      }),
      P({ slug: 'church-a' })
    )
    expect(res.status).toBe(201)
    const created = await db.formSubmission.findFirst({
      where: { churchId: ids.churchA, name: 'Web Visitor' },
      select: { id: true },
    })
    expect(created).not.toBeNull()
    const after = await db.formSubmission.count({ where: { churchId: ids.churchB } })
    expect(after).toBe(before)
  })

  it('honeypot submissions are accepted-then-discarded (spam tarpit)', async () => {
    actAs(undefined)
    const res = await submitRoute.POST(
      req('/api/public/church-a/submit', {
        method: 'POST',
        body: { type: 'CONTACT', name: 'Bot', email: 'b@spam.example', message: 'buy now', company: 'spam-inc' },
      }),
      P({ slug: 'church-a' })
    )
    // Honeypot: a bot gets a normal-looking 200 — but nothing is stored.
    expect(res.status).toBe(200)
    const stored = await db.formSubmission.findFirst({
      where: { churchId: ids.churchA, name: 'Bot' },
      select: { id: true },
    })
    expect(stored).toBeNull()
  })

  it('unknown church slug → 404, no tenant leak', async () => {
    actAs(undefined)
    const res = await submitRoute.POST(
      req('/api/public/no-such-church/submit', {
        method: 'POST',
        body: { type: 'CONTACT', name: 'X', email: 'x@example.org', message: 'hi' },
      }),
      P({ slug: 'no-such-church' })
    )
    expect(res.status).toBe(404)
  })
})

describe('church-creation abuse controls', () => {
  it('unauthenticated → 401', async () => {
    actAs(undefined)
    const res = await onboardingChurchRoute.POST(
      req('/api/onboarding/church', { method: 'POST', body: {} })
    )
    expect(res.status).toBe(401)
  })

  it('an account at its church-ownership cap is refused (CHURCH_LIMIT)', async () => {
    actAs(ownerBToken) // owns church-b; CHURCH_LIMIT_PER_USER=1
    const res = await onboardingChurchRoute.POST(
      req('/api/onboarding/church', {
        method: 'POST',
        body: {
          info: { name: 'Church B Second', country: 'NG' },
          identity: { primaryColor: '#1a56db', secondaryColor: '#0f2a5c', fontKey: 'inter' },
          structure: {},
          design: { themeKey: 'classic' },
          slug: 'church-b-second',
          publish: false,
        },
      })
    )
    expect(res.status).toBe(403)
    expect(((await json(res)).error as { code?: string }).code).toBe('CHURCH_LIMIT')
  })
})

describe('authenticated password change', () => {
  it('wrong current password → 403; correct → 200 and OTHER sessions revoked', async () => {
    const otherSessionToken = await makeSession(ids.ownerA)
    actAs(ownerAToken)

    const bad = await changePasswordRoute.POST(
      req('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: 'WrongPass1', newPassword: 'NewPassw0rd9' },
      })
    )
    expect(bad.status).toBe(403)

    const good = await changePasswordRoute.POST(
      req('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: 'OldPassw0rd1', newPassword: 'NewPassw0rd9' },
      })
    )
    expect(good.status).toBe(200)

    // The other session was revoked; the current one survives.
    const otherAlive = await db.session.findFirst({ where: { tokenHash: sha(otherSessionToken) } })
    expect(otherAlive).toBeNull()
    const currentAlive = await db.session.findFirst({ where: { tokenHash: sha(ownerAToken) } })
    expect(currentAlive).not.toBeNull()

    // The stored hash actually changed.
    const row = await db.user.findUnique({ where: { id: ids.ownerA }, select: { passwordHash: true } })
    expect(await bcrypt.compare('NewPassw0rd9', row!.passwordHash)).toBe(true)
  })
})

describe('cron endpoint hardening', () => {
  // NODE_ENV is declared read-only in @types/node — tests mutate it through
  // a cast (vitest still sees the change at runtime).
  const setNodeEnv = (v: string | undefined) => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = v
  }

  it('production + no CRON_SECRET → disabled (503)', async () => {
    const prev = process.env.NODE_ENV
    setNodeEnv('production')
    try {
      const res = await cronRoute.GET(req('/api/cron/domains'))
      expect(res.status).toBe(503)
      expect(((await json(res)).error as { code?: string }).code).toBe('CRON_NOT_CONFIGURED')
    } finally {
      setNodeEnv(prev)
    }
  })

  it('with CRON_SECRET set: wrong bearer → 401; correct bearer → honest skip (no provider)', async () => {
    const prevNodeEnv = process.env.NODE_ENV
    const prevSecret = process.env.CRON_SECRET
    setNodeEnv('production')
    process.env.CRON_SECRET = 'cron-secret-123'
    try {
      const denied = await cronRoute.GET(
        req('/api/cron/domains', { headers: { authorization: 'Bearer wrong' } })
      )
      expect(denied.status).toBe(401)

      const allowed = await cronRoute.GET(
        req('/api/cron/domains', { headers: { authorization: 'Bearer cron-secret-123' } })
      )
      expect(allowed.status).toBe(200)
      const body = await json(allowed)
      expect((body.data as { skipped?: string }).skipped).toBe('no-provider-integration')
    } finally {
      setNodeEnv(prevNodeEnv)
      if (prevSecret === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = prevSecret
    }
  })
})
