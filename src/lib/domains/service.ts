import 'server-only'
import { db } from '@/lib/db'
import { validateCustomDomain, txtRecordName, type DomainValidation } from './validate'
import {
  generateVerificationToken,
  hashVerificationToken,
  checkOwnershipTxt,
  TOKEN_TTL_MS,
  type TxtResolver,
} from './txt'
import { getDomainProvider } from './provider'
import { invalidateAllHosts, invalidateHost } from './cache'
import { recordAudit } from '@/lib/audit'
import type { ChurchRole } from '@/lib/permissions'

/**
 * Custom-domain lifecycle service.
 *
 * Status machine (ChurchDomain.status):
 *   PENDING  — added; awaiting TXT ownership verification
 *   VERIFIED — DNS TXT proves the church owns the hostname
 *   ACTIVE   — hosting assignment confirmed (provider API in Vercel mode;
 *              owner-confirmed in manual/self-hosted mode). ONLY ACTIVE
 *              domains resolve to tenants.
 *   (REMOVED — rows are deleted; the audit log retains the history.)
 *
 * Concurrency: `domain` is globally UNIQUE. Claiming races collapse into a
 * constraint violation which the service translates into a precise outcome:
 * never a silent transfer between tenants.
 */

export type DomainActionOutcome<T> = ({ ok: true } & T) | { ok: false; status: number; error: string; code: string }

export type DomainView = {
  id: string
  domain: string
  type: string
  status: string
  isPrimary: boolean
  provider: string | null
  sslStatus: string | null
  failureReason: string | null
  verifiedAt: string | null
  lastCheckedAt: string | null
  tokenExpiresAt: string | null
  /** Populated only when the caller just (re)generated the token. */
  verificationToken?: string
  txtRecord?: { name: string; value: string }
  /** Parsed provider status (required DNS records etc.), when connected. */
  providerInfo?: {
    assigned: boolean
    dnsConfigured: boolean | null
    error: string | null
    requiredRecords: { type: string; name: string; value: string; note?: string }[]
  } | null
}

/** Serialise a row for API responses. */
function toView(
  d: {
    id: string
    domain: string
    type: string
    status: string
    isPrimary: boolean
    provider: string | null
    providerStatus: string | null
    sslStatus: string | null
    failureReason: string | null
    verifiedAt: Date | null
    lastCheckedAt: Date | null
    tokenExpiresAt: Date | null
  },
  plainToken?: string
): DomainView {
  let providerInfo: DomainView['providerInfo'] = null
  if (d.providerStatus) {
    try {
      const parsed = JSON.parse(d.providerStatus) as {
        assigned?: boolean
        dnsConfigured?: boolean | null
        error?: string | null
        requiredRecords?: { type: string; name: string; value: string; note?: string }[]
      }
      providerInfo = {
        assigned: parsed.assigned === true,
        dnsConfigured: parsed.dnsConfigured ?? null,
        error: parsed.error ?? null,
        requiredRecords: parsed.requiredRecords ?? [],
      }
    } catch {
      providerInfo = null
    }
  }
  return {
    id: d.id,
    domain: d.domain,
    type: d.type,
    status: d.status,
    isPrimary: d.isPrimary,
    provider: d.provider,
    sslStatus: d.sslStatus,
    failureReason: d.failureReason,
    verifiedAt: d.verifiedAt?.toISOString() ?? null,
    lastCheckedAt: d.lastCheckedAt?.toISOString() ?? null,
    tokenExpiresAt: d.tokenExpiresAt?.toISOString() ?? null,
    providerInfo,
    ...(plainToken ? { verificationToken: plainToken, txtRecord: { name: txtRecordName(d.domain), value: `openchurch-verify=${plainToken}` } } : {}),
  }
}

export async function listDomains(churchId: string): Promise<DomainView[]> {
  const rows = await db.churchDomain.findMany({
    where: { churchId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })
  return rows.map((r) => toView(r))
}

export async function addDomain(input: {
  churchId: string
  actorUserId: string
  actorEmail: string
  rawDomain: string
}): Promise<DomainActionOutcome<{ domain: DomainView }>> {
  const { churchId, actorUserId, actorEmail } = input
  const validation: DomainValidation = validateCustomDomain(input.rawDomain)
  if (!validation.ok) return { ok: false, status: 400, error: validation.error, code: 'INVALID_DOMAIN' }
  const domain = validation.domain

  const existing = await db.churchDomain.findUnique({ where: { domain } })

  if (existing && existing.churchId === churchId) {
    if (existing.status === 'PENDING') {
      // Idempotent re-add: refresh the token so instructions stay valid.
      return regenerateToken({ churchId, domainId: existing.id, actorUserId, actorEmail })
    }
    return { ok: false, status: 409, error: 'That domain is already connected to your church.', code: 'ALREADY_ADDED' }
  }

  if (existing && existing.churchId !== churchId) {
    if (existing.status === 'VERIFIED' || existing.status === 'ACTIVE') {
      // Never reveal WHICH church owns it.
      return { ok: false, status: 409, error: 'That domain is already in use by another church.', code: 'DOMAIN_TAKEN' }
    }
    // PENDING claim by another church: only reclaimable once expired.
    if (existing.tokenExpiresAt && existing.tokenExpiresAt.getTime() > Date.now()) {
      return {
        ok: false,
        status: 409,
        error: 'That domain was recently added by another church and is still pending verification.',
        code: 'CLAIM_PENDING',
      }
    }
    // Stale, expired claim — replace it (audited).
    await db.churchDomain.delete({ where: { id: existing.id } })
    await recordAudit({
      churchId: existing.churchId,
      actorUserId,
      actorEmail,
      action: 'domain.staleClaimReplaced',
      entityType: 'church_domain',
      entityId: existing.id,
      metadata: { domain, note: 'expired pending claim replaced by another church' },
    })
  }

  const token = generateVerificationToken()
  const provider = getDomainProvider()
  try {
    const row = await db.churchDomain.create({
      data: {
        churchId,
        domain,
        type: 'CUSTOM',
        status: 'PENDING',
        verificationTokenHash: hashVerificationToken(token),
        tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        provider: provider?.kind ?? null,
      },
    })
    await recordAudit({
      churchId,
      actorUserId,
      actorEmail,
      action: 'domain.added',
      entityType: 'church_domain',
      entityId: row.id,
      metadata: { domain },
    })
    invalidateHost(domain)
    return { ok: true, domain: toView(row, token) }
  } catch (err) {
    // P2002 = unique violation: another request claimed it first.
    if ((err as { code?: string })?.code === 'P2002') {
      return { ok: false, status: 409, error: 'That domain was just added by another church.', code: 'DOMAIN_TAKEN' }
    }
    throw err
  }
}

/** Refresh the verification token (old token becomes invalid). */
export async function regenerateToken(input: {
  churchId: string
  domainId: string
  actorUserId: string
  actorEmail: string
}): Promise<DomainActionOutcome<{ domain: DomainView }>> {
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }
  if (row.status !== 'PENDING') {
    return { ok: false, status: 400, error: 'This domain is already verified.', code: 'ALREADY_VERIFIED' }
  }
  const token = generateVerificationToken()
  const updated = await db.churchDomain.update({
    where: { id: row.id },
    data: {
      verificationTokenHash: hashVerificationToken(token),
      tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      failureReason: null,
    },
  })
  await recordAudit({
    churchId: input.churchId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    action: 'domain.tokenRegenerated',
    entityType: 'church_domain',
    entityId: row.id,
    metadata: { domain: row.domain },
  })
  return { ok: true, domain: toView(updated, token) }
}

/**
 * Run the DNS TXT ownership check. Pure DNS truth — the flag flips only
 * when the record carries the token.
 */
export async function verifyDomain(input: {
  churchId: string
  domainId: string
  actorUserId: string
  actorEmail: string
  resolver?: TxtResolver
}): Promise<DomainActionOutcome<{ domain: DomainView }>> {
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }
  if (row.status === 'VERIFIED' || row.status === 'ACTIVE') {
    return { ok: true, domain: toView(row) }
  }
  if (!row.verificationTokenHash || !row.tokenExpiresAt) {
    return { ok: false, status: 400, error: 'No verification token — re-add the domain.', code: 'NO_TOKEN' }
  }
  if (row.tokenExpiresAt.getTime() < Date.now()) {
    // Token expired: transparently regenerate and hand back instructions.
    return regenerateToken({
      churchId: input.churchId,
      domainId: row.id,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
  }

  // The stored hash cannot be reversed — but verification needs the PLAIN
  // token to compare against DNS. The plain token is only ever handed to
  // the dashboard in the add/regenerate response; to verify we must ask DNS
  // for a record matching the HASH-derived value... — since DNS carries the
  // plain token, we compare digests: resolve TXT values and hash each.
  const check = await checkOwnershipByHash(row.domain, row.verificationTokenHash, input.resolver)

  if (check.ok) {
    const updated = await db.churchDomain.update({
      where: { id: row.id },
      data: {
        status: 'VERIFIED',
        isVerified: true,
        verifiedAt: new Date(),
        lastCheckedAt: new Date(),
        failureReason: null,
      },
    })
    await recordAudit({
      churchId: input.churchId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      action: 'domain.verified',
      entityType: 'church_domain',
      entityId: row.id,
      metadata: { domain: row.domain },
    })
    invalidateHost(row.domain)
    return { ok: true, domain: toView(updated) }
  }

  const updated = await db.churchDomain.update({
    where: { id: row.id },
    data: { lastCheckedAt: new Date(), failureReason: check.reason },
  })
  return { ok: true, domain: toView(updated) }
}

/** Resolve TXT values and compare each candidate's digest to the stored hash. */
async function checkOwnershipByHash(
  domain: string,
  tokenHash: string,
  resolver?: TxtResolver
): Promise<{ ok: boolean; reason?: string }> {
  const name = txtRecordName(domain)
  let records: string[][]
  try {
    const resolve = resolver ?? ((n: string) => import('dns/promises').then((m) => m.resolveTxt(n)))
    records = await resolve(name)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENODATA' || code === 'ENOTFOUND') {
      return { ok: false, reason: `No TXT record found at ${name} yet — DNS can take a few minutes to propagate.` }
    }
    return { ok: false, reason: 'The DNS lookup failed — try again in a moment.' }
  }
  const { createHash } = await import('crypto')
  for (const record of records) {
    const value = (record ?? []).join('')
    if (value.startsWith('openchurch-verify=')) {
      const digest = createHash('sha256').update(value.slice('openchurch-verify='.length)).digest('hex')
      if (digest === tokenHash) return { ok: true }
    }
  }
  return { ok: false, reason: `The TXT record at ${name} does not carry the expected value yet — DNS can take a few minutes to propagate.` }
}

/**
 * Attach the domain to the hosting provider (or record the manual
 * confirmation). Only the provider's own confirmation (or the explicit
 * manual owner confirmation) can set ACTIVE.
 */
export async function connectDomain(input: {
  churchId: string
  domainId: string
  actorUserId: string
  actorEmail: string
}): Promise<DomainActionOutcome<{ domain: DomainView }>> {
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }
  if (row.status !== 'VERIFIED') {
    return { ok: false, status: 400, error: 'Verify domain ownership first.', code: 'NOT_VERIFIED' }
  }

  const provider = getDomainProvider()
  if (!provider) {
    return {
      ok: false,
      status: 503,
      error: 'No hosting provider is configured on this deployment. Follow the manual DNS instructions instead.',
      code: 'NO_PROVIDER',
    }
  }

  const added = await provider.addDomain(row.domain)
  if (!added.ok) {
    await db.churchDomain.update({
      where: { id: row.id },
      data: { failureReason: added.error, lastCheckedAt: new Date() },
    })
    return { ok: false, status: 502, error: added.error, code: 'PROVIDER_ERROR' }
  }

  const status = await provider.inspectDomain(row.domain)
  const ssl = status.assigned ? 'PROVISIONING' : 'PENDING'

  const updated = await db.churchDomain.update({
    where: { id: row.id },
    data: {
      status: status.assigned ? 'ACTIVE' : 'VERIFIED',
      providerStatus: JSON.stringify({
        assigned: status.assigned,
        dnsConfigured: status.dnsConfigured,
        error: status.error,
        requiredRecords: status.requiredRecords,
        raw: status.raw,
      }),
      sslStatus: ssl,
      failureReason: status.error,
      lastCheckedAt: new Date(),
    },
  })
  await recordAudit({
    churchId: input.churchId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    action: 'domain.connected',
    entityType: 'church_domain',
    entityId: row.id,
    metadata: { domain: row.domain, provider: provider.kind, assigned: status.assigned },
  })
  invalidateHost(row.domain)
  return { ok: true, domain: toView(updated) }
}

/**
 * Manual/self-hosted confirmation: the owner asserts they pointed DNS at
 * their host and configured the proxy. Available ONLY in manual mode —
 * when a provider API is configured, provider truth is required instead.
 */
export async function confirmManualConnection(input: {
  churchId: string
  domainId: string
  actorUserId: string
  actorEmail: string
}): Promise<DomainActionOutcome<{ domain: DomainView }>> {
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }
  if (row.status !== 'VERIFIED') {
    return { ok: false, status: 400, error: 'Verify domain ownership first.', code: 'NOT_VERIFIED' }
  }
  const provider = getDomainProvider()
  if (provider?.kind === 'vercel') {
    return {
      ok: false,
      status: 400,
      error: 'This deployment uses automated hosting assignment — use "Connect hosting" instead.',
      code: 'AUTOMATED_PROVIDER',
    }
  }
  const updated = await db.churchDomain.update({
    where: { id: row.id },
    data: {
      status: 'ACTIVE',
      provider: 'manual',
      providerStatus: JSON.stringify({ mode: 'manual', ownerConfirmed: true }),
      sslStatus: 'MANAGED_BY_HOST',
      lastCheckedAt: new Date(),
      failureReason: null,
    },
  })
  await recordAudit({
    churchId: input.churchId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    action: 'domain.manualConfirmed',
    entityType: 'church_domain',
    entityId: row.id,
    metadata: { domain: row.domain },
  })
  invalidateHost(row.domain)
  return { ok: true, domain: toView(updated) }
}

/**
 * Set the primary (canonical) domain. Requires ACTIVE. Clears the flag on
 * the church's other domains so exactly one primary exists.
 */
export async function setPrimaryDomain(input: {
  churchId: string
  domainId: string
  actorUserId: string
  actorEmail: string
}): Promise<DomainActionOutcome<{ domain: DomainView }>> {
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }
  if (row.status !== 'ACTIVE') {
    return { ok: false, status: 400, error: 'Only an active domain can be the primary domain.', code: 'NOT_ACTIVE' }
  }
  await db.$transaction([
    db.churchDomain.updateMany({ where: { churchId: input.churchId, isPrimary: true }, data: { isPrimary: false } }),
    db.churchDomain.update({ where: { id: row.id }, data: { isPrimary: true } }),
  ])
  await recordAudit({
    churchId: input.churchId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    action: 'domain.primaryChanged',
    entityType: 'church_domain',
    entityId: row.id,
    metadata: { domain: row.domain },
  })
  invalidateAllHosts()
  const updated = await db.churchDomain.findUniqueOrThrow({ where: { id: row.id } })
  return { ok: true, domain: toView(updated) }
}

/**
 * Remove a domain: delete the row (the audit log keeps the history), ask
 * the provider to detach (best-effort — the mapping is gone either way),
 * and invalidate caches. The church's platform slug route is unaffected.
 */
export async function removeDomain(input: {
  churchId: string
  domainId: string
  actorUserId: string
  actorEmail: string
}): Promise<DomainActionOutcome<{ removed: true }>> {
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }

  const provider = getDomainProvider()
  let providerError: string | null = null
  if (provider && row.status !== 'PENDING' && row.provider === provider.kind) {
    const res = await provider.removeDomain(row.domain)
    if (!res.ok) providerError = res.error
  }

  await db.churchDomain.delete({ where: { id: row.id } })
  await recordAudit({
    churchId: input.churchId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    action: 'domain.removed',
    entityType: 'church_domain',
    entityId: row.id,
    metadata: { domain: row.domain, status: row.status, providerError },
  })
  invalidateHost(row.domain)
  invalidateAllHosts()
  return { ok: true, removed: true }
}

/**
 * The church's ACTIVE primary domain (canonical host), if any.
 * Used by URL/canonical generation. Non-primary ACTIVE domains still
 * resolve, but canonical URLs point at the primary.
 */
export async function getPrimaryDomain(churchId: string): Promise<string | null> {
  const row = await db.churchDomain.findFirst({
    where: { churchId, status: 'ACTIVE', isPrimary: true },
    select: { domain: true },
  })
  if (row) return row.domain
  // No explicit primary: when the church has exactly ONE active domain it is
  // the obvious canonical host (the flag only arbitrates between several).
  const active = await db.churchDomain.findMany({
    where: { churchId, status: 'ACTIVE' },
    select: { domain: true },
  })
  return active.length === 1 ? active[0].domain : null
}

/**
 * The church's ACTIVE domain matching the current request host (when the
 * page is being served under one of the church's own domains).
 */
export async function getActiveDomainForHost(churchId: string, host: string | null): Promise<string | null> {
  if (!host) return null
  const hostname = host.split(':')[0].toLowerCase().replace(/\.$/, '')
  if (!hostname) return null
  const row = await db.churchDomain.findFirst({
    where: { churchId, domain: hostname, status: 'ACTIVE' },
    select: { domain: true },
  })
  return row?.domain ?? null
}

export type CanonicalOrigin = {
  origin: string
  /**
   * True when the origin is one of the church's own domains — church paths
   * then live at the ROOT (https://domain/about) instead of the platform
   * prefix (https://platform/church/slug/about).
   */
  isChurchDomain: boolean
}

/**
 * Canonical origin for a church's public URLs (canonical link, OG, sitemap).
 *
 * Precedence — one consistent canonical host per church, so a page reachable
 * at both the platform slug route and the custom domain never creates
 * duplicate-content ambiguity:
 *   1. the church's ACTIVE PRIMARY custom domain;
 *   2. the custom domain the request is being served under (when the church
 *      has ACTIVE domains but no primary chosen yet);
 *   3. the platform origin (PATH mode — no custom domain in play).
 */
export async function resolveCanonicalOrigin(
  churchId: string,
  platformOrigin: string,
  requestHost: string | null
): Promise<CanonicalOrigin> {
  const primary = await getPrimaryDomain(churchId)
  if (primary) return { origin: `https://${primary}`, isChurchDomain: true }
  const serving = await getActiveDomainForHost(churchId, requestHost)
  if (serving) return { origin: `https://${serving}`, isChurchDomain: true }
  return { origin: platformOrigin, isChurchDomain: false }
}

/** Absolute canonical URL for a church path, honouring the origin mode. */
export function churchCanonicalUrl(canon: CanonicalOrigin, slug: string, path = ''): string {
  const clean = path.replace(/^\//, '')
  if (canon.isChurchDomain) {
    return clean ? `${canon.origin.replace(/\/$/, '')}/${clean}` : canon.origin
  }
  const suffix = clean ? `/${clean}` : ''
  return `${canon.origin.replace(/\/$/, '')}/church/${slug}${suffix}`
}
