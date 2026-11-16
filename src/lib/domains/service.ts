import 'server-only'
import { db } from '@/lib/db'
import { validateCustomDomain, txtRecordName, type DomainValidation } from './validate'
import {
  generateVerificationToken,
  hashVerificationToken,
  TOKEN_TTL_MS,
  type TxtResolver,
} from './txt'
import { getDomainProvider, type DomainProvider, type ProviderDomainStatus } from './provider'
import { domainsOperable, getDomainCapability } from './capability'
import { invalidateAllHosts, invalidateHost } from './cache'
import { recordAudit } from '@/lib/audit'
import { apexWwwCompanion, ownershipVerified, isDomainStatus } from './status'
import { getDomainEntitlement } from './entitlements'

/**
 * Custom-domain lifecycle service.
 *
 * Full status machine (lib/domains/status.ts):
 *   PENDING → VERIFICATION_FAILED (retryable) → VERIFIED → PENDING_DNS →
 *   PENDING_SSL → ACTIVE, plus FAILED (provider lost/never completed
 *   assignment) and SUSPENDED (operator kill-switch). Rows are DELETED on
 *   removal; the audit log keeps the history.
 *
 * Concurrency: `domain` is globally UNIQUE. Claiming races collapse into a
 * constraint violation which the service translates into a precise outcome:
 * never a silent transfer between tenants.
 */

export type DomainActionOutcome<T> = ({ ok: true } & T) | { ok: false; status: number; error: string; code: string }

/**
 * The deployment cannot offer the domain workflow at all (managed hosting
 * without the domain-assignment integration — e.g. the hosted demonstration).
 * Mutations are refused with an honest explanation; listing and removal
 * stay available so existing rows remain visible and cleanable.
 */
function unavailableOutcome() {
  return {
    ok: false as const,
    status: 403,
    error:
      'Custom domains are not available on this deployment: it runs on managed hosting without the domain-assignment integration, so the platform cannot complete the required configuration. Your website stays reachable at its platform address; custom domains are supported on self-hosted installations and on managed hosting with the integration enabled (docs/DEPLOYMENT.md).',
    code: 'DOMAINS_UNAVAILABLE',
  }
}

export type DomainView = {
  id: string
  domain: string
  type: string
  status: string
  isPrimary: boolean
  provider: string | null
  providerRef: string | null
  dnsStatus: string | null
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
    providerRef: string | null
    providerStatus: string | null
    dnsStatus: string | null
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
    providerRef: d.providerRef,
    dnsStatus: d.dnsStatus,
    sslStatus: d.sslStatus,
    failureReason: d.failureReason,
    verifiedAt: d.verifiedAt?.toISOString() ?? null,
    lastCheckedAt: d.lastCheckedAt?.toISOString() ?? null,
    tokenExpiresAt: d.tokenExpiresAt?.toISOString() ?? null,
    providerInfo,
    ...(plainToken ? { verificationToken: plainToken, txtRecord: { name: txtRecordName(d.domain), value: `openchurch-verify=${plainToken}` } } : {}),
  }
}

// ---------------------------------------------------------------------------
// HTTPS probe — the only honest SSL check we can run ourselves
// ---------------------------------------------------------------------------

export type HttpsProbe = (domain: string) => Promise<{ ok: boolean; reason?: string }>

/**
 * Probe https://<domain>/ with a short timeout. ANY HTTP response proves the
 * TLS handshake succeeded (the certificate is live); a network/certificate
 * error means HTTPS is not serving yet. Never throws.
 */
export const probeHttps: HttpsProbe = async (domain) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)
  try {
    await fetch(`https://${domain}/`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'OpenChurch-DomainProbe/1.0' },
    })
    return { ok: true }
  } catch {
    return { ok: false, reason: 'HTTPS is not reachable on this domain yet.' }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Listing / claims
// ---------------------------------------------------------------------------

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
}): Promise<DomainActionOutcome<{ domain: DomainView; companionSuggestion?: string }>> {
  const { churchId, actorUserId, actorEmail } = input
  if (!domainsOperable()) return unavailableOutcome()
  const validation: DomainValidation = validateCustomDomain(input.rawDomain)
  if (!validation.ok) return { ok: false, status: 400, error: validation.error, code: 'INVALID_DOMAIN' }
  const domain = validation.domain

  const existing = await db.churchDomain.findUnique({ where: { domain } })

  if (existing && existing.churchId === churchId) {
    if (existing.status === 'PENDING' || existing.status === 'VERIFICATION_FAILED') {
      // Idempotent re-add: refresh the token so instructions stay valid.
      return regenerateToken({ churchId, domainId: existing.id, actorUserId, actorEmail })
    }
    return { ok: false, status: 409, error: 'That domain is already connected to your church.', code: 'ALREADY_ADDED' }
  }

  // Plan entitlement: a NEW claim requires headroom under the church's plan.
  const entitlement = await getDomainEntitlement(churchId)
  if (!entitlement.canAdd) {
    return {
      ok: false,
      status: 403,
      error:
        entitlement.upgradeHint ??
        `Your church\u2019s plan (${entitlement.plan}) allows ${entitlement.limit} custom domain${entitlement.limit === 1 ? '' : 's'}. Ask your platform operator about upgrading your plan.`,
      code: 'PLAN_LIMIT',
    }
  }

  if (existing && existing.churchId !== churchId) {
    if (ownershipVerified(existing.status) || existing.status === 'ACTIVE') {
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
    // www↔apex relationship: suggest the companion hostname when the church
    // has not connected it yet (they are separate claims by design — each
    // must pass its own ownership check).
    const companion = apexWwwCompanion(domain)
    let companionSuggestion: string | undefined
    if (companion) {
      const has = await db.churchDomain.findUnique({ where: { domain: companion }, select: { churchId: true } })
      if (!has || has.churchId !== churchId) {
        companionSuggestion = companion
      }
    }
    return { ok: true, domain: toView(row, token), ...(companionSuggestion ? { companionSuggestion } : {}) }
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
  if (!domainsOperable()) return unavailableOutcome()
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }
  if (row.status !== 'PENDING' && row.status !== 'VERIFICATION_FAILED') {
    return { ok: false, status: 400, error: 'This domain is already verified.', code: 'ALREADY_VERIFIED' }
  }
  const token = generateVerificationToken()
  const updated = await db.churchDomain.update({
    where: { id: row.id },
    data: {
      status: 'PENDING', // fresh token = fresh verification attempt
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
 * when the record carries the token. A failed check marks the row
 * VERIFICATION_FAILED (retryable; the row stays unverified).
 */
export async function verifyDomain(input: {
  churchId: string
  domainId: string
  actorUserId: string
  actorEmail: string
  resolver?: TxtResolver
}): Promise<DomainActionOutcome<{ domain: DomainView }>> {
  if (!domainsOperable()) return unavailableOutcome()
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }
  if (ownershipVerified(row.status)) {
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
    data: {
      status: 'VERIFICATION_FAILED',
      lastCheckedAt: new Date(),
      failureReason: check.reason,
    },
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
  const { createHash, timingSafeEqual } = await import('crypto')
  /** Constant-time hex comparison (both digests are 64-char SHA-256 hex). */
  const digestMatches = (a: string, b: string) =>
    a.length === b.length && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  for (const record of records) {
    const value = (record ?? []).join('')
    if (value.startsWith('openchurch-verify=')) {
      const digest = createHash('sha256').update(value.slice('openchurch-verify='.length)).digest('hex')
      if (digestMatches(digest, tokenHash)) return { ok: true }
    }
  }
  return { ok: false, reason: `The TXT record at ${name} does not carry the expected value yet — DNS can take a few minutes to propagate.` }
}

// ---------------------------------------------------------------------------
// Provider assignment (connect) + rechecks
// ---------------------------------------------------------------------------

type ManagedProvider = DomainProvider & { configured: boolean }

/** Resolve the managed provider, or an injectable test double. */
function resolveProvider(injected?: ManagedProvider): ManagedProvider | null {
  if (injected) return injected
  return getDomainProvider()
}

/**
 * Derive the post-inspect row state from the provider's view of the domain.
 * Shared by connect and recheck so both paths apply IDENTICAL truth rules.
 */
async function deriveProviderState(
  domain: string,
  status: ProviderDomainStatus,
  opts: { probe?: HttpsProbe; skipProbe?: boolean }
): Promise<{
  status: 'PENDING_DNS' | 'PENDING_SSL' | 'ACTIVE' | 'FAILED'
  dnsStatus: 'PENDING' | 'OK' | 'ERROR'
  sslStatus: 'PENDING' | 'PROVISIONING' | 'ACTIVE' | 'UNKNOWN'
  failureReason: string | null
}> {
  // 1. The provider no longer has the domain → FAILED (never a fake ACTIVE).
  if (status.missing) {
    return {
      status: 'FAILED',
      dnsStatus: 'PENDING',
      sslStatus: 'UNKNOWN',
      failureReason: 'The hosting provider no longer has this domain attached — retry the connection.',
    }
  }
  // 2. Attached but the provider has not verified it yet (its own TXT/DNS
  //    check pending) → awaiting DNS.
  if (!status.assigned) {
    return {
      status: 'PENDING_DNS',
      dnsStatus: 'PENDING',
      sslStatus: 'PENDING',
      failureReason: status.error ?? 'The hosting provider is waiting for the DNS records shown below.',
    }
  }
  // 3. Assigned but the provider reports the DNS configuration is wrong.
  if (status.dnsConfigured === false) {
    return {
      status: 'PENDING_DNS',
      dnsStatus: 'ERROR',
      sslStatus: 'PENDING',
      failureReason: status.error ?? 'The hosting provider reports the DNS configuration is not correct yet.',
    }
  }
  // 4. Assigned + DNS configured per the provider → confirm HTTPS ourselves.
  if (opts.skipProbe) {
    return { status: 'PENDING_SSL', dnsStatus: 'OK', sslStatus: 'PROVISIONING', failureReason: null }
  }
  const probe = opts.probe ?? probeHttps
  const probed = await probe(domain)
  if (probed.ok) {
    return { status: 'ACTIVE', dnsStatus: 'OK', sslStatus: 'ACTIVE', failureReason: null }
  }
  return {
    status: 'PENDING_SSL',
    dnsStatus: 'OK',
    sslStatus: 'PROVISIONING',
    failureReason:
      (probed.reason ?? 'HTTPS is not live on this domain yet.') +
      ' SSL certificates are issued automatically once DNS has fully propagated — this usually completes within minutes to a few hours.',
  }
}

function serializeProviderStatus(status: ProviderDomainStatus): string {
  return JSON.stringify({
    assigned: status.assigned,
    missing: status.missing,
    dnsConfigured: status.dnsConfigured,
    error: status.error,
    requiredRecords: status.requiredRecords,
    raw: status.raw,
  })
}

/**
 * Attach the domain to the hosting provider (managed mode) — or inspect it
 * when it is already attached. Retries from FAILED are explicitly allowed.
 * Only the provider's own confirmation (or, for the HTTPS leg, a successful
 * probe) can set ACTIVE.
 */
export async function connectDomain(input: {
  churchId: string
  domainId: string
  actorUserId: string
  actorEmail: string
  provider?: ManagedProvider
  probe?: HttpsProbe
}): Promise<DomainActionOutcome<{ domain: DomainView }>> {
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }
  if (row.status === 'SUSPENDED') {
    return { ok: false, status: 400, error: 'This domain is suspended by the platform operator.', code: 'SUSPENDED' }
  }
  if (!ownershipVerified(row.status)) {
    return { ok: false, status: 400, error: 'Verify domain ownership first.', code: 'NOT_VERIFIED' }
  }

  if (!domainsOperable()) return unavailableOutcome()
  const cap = getDomainCapability()
  // Self-hosted mode (including an explicit CUSTOM_DOMAIN_MODE=manual
  // override): automated attach cannot work here — the dashboard's manual
  // confirmation step is the supported path.
  if (cap.mode === 'self-hosted') {
    return {
      ok: false,
      status: 503,
      error:
        'This deployment has no automated hosting-provider integration. Point your domain at the server per the DNS instructions and use "Confirm manual connection" instead.',
      code: 'NO_PROVIDER',
    }
  }
  const provider = resolveProvider(input.provider)
  if (!provider?.configured) {
    // Defensive: managed-auto implies a configured provider; this guards
    // against configuration changing between the checks above.
    return {
      ok: false,
      status: 503,
      error:
        'This deployment has no automated hosting-provider integration. Point your domain at the server per the DNS instructions and use "Confirm manual connection" instead.',
      code: 'NO_PROVIDER',
    }
  }

  // Already attached at the provider (PENDING_DNS / PENDING_SSL / ACTIVE):
  // re-adding is unnecessary — run the shared recheck instead.
  if (row.status === 'PENDING_DNS' || row.status === 'PENDING_SSL' || row.status === 'ACTIVE') {
    return recheckDomain({ ...input, provider, probe: input.probe })
  }

  // VERIFIED (first connect) or FAILED (retry): (re-)attach, then inspect.
  const added = await provider.addDomain(row.domain)
  if (!added.ok) {
    await db.churchDomain.update({
      where: { id: row.id },
      data: { failureReason: added.error, lastCheckedAt: new Date() },
    })
    return { ok: false, status: 502, error: added.error, code: 'PROVIDER_ERROR' }
  }

  const status = await provider.inspectDomain(row.domain)
  const derived = await deriveProviderState(row.domain, status, { probe: input.probe })

  const updated = await db.churchDomain.update({
    where: { id: row.id },
    data: {
      status: derived.status,
      isVerified: true,
      dnsStatus: derived.dnsStatus,
      sslStatus: derived.sslStatus,
      failureReason: derived.failureReason,
      provider: provider.kind,
      providerRef: added.providerRef ?? status.providerRef ?? row.providerRef,
      providerStatus: serializeProviderStatus(status),
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
    metadata: { domain: row.domain, provider: provider.kind, status: derived.status },
  })
  invalidateHost(row.domain)
  if (derived.status !== 'ACTIVE') invalidateAllHosts()
  return { ok: true, domain: toView(updated) }
}

/**
 * Re-check a provider-assigned domain: provider inspection + HTTPS probe.
 * Used by the dashboard ("Check status"), the stale-recheck on list, and
 * the background cron. Safe to run repeatedly; can DOWNGRADE an ACTIVE row
 * to FAILED when the provider no longer has the domain (a provider failure
 * never leaves a misleading active record).
 */
export async function recheckDomain(input: {
  churchId: string
  domainId: string
  actorUserId?: string
  actorEmail?: string
  provider?: ManagedProvider
  probe?: HttpsProbe
  skipProbe?: boolean
}): Promise<DomainActionOutcome<{ domain: DomainView }>> {
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }
  if (row.status === 'SUSPENDED') {
    return { ok: false, status: 400, error: 'This domain is suspended by the platform operator.', code: 'SUSPENDED' }
  }
  if (!['PENDING_DNS', 'PENDING_SSL', 'ACTIVE', 'FAILED'].includes(row.status)) {
    return {
      ok: false,
      status: 400,
      error: 'Connect the domain to hosting first — this status has nothing to re-check at the provider.',
      code: 'NOT_CONNECTED',
    }
  }
  const provider = resolveProvider(input.provider)
  // Only AUTOMATED providers (a real API that can verify assignment) may
  // re-check — the manual adapter can never confirm anything, and rechecking
  // a row against a different provider than the one that assigned it would
  // produce nonsense. Provider-agnostic: any future API-backed adapter sets
  // `automated: true` and works here without further changes.
  if (
    !provider?.configured ||
    !provider.automated ||
    (row.provider !== null && row.provider !== provider.kind)
  ) {
    return {
      ok: false,
      status: 503,
      error: 'This deployment has no automated hosting-provider integration to re-check against.',
      code: 'NO_PROVIDER',
    }
  }

  const status = await provider.inspectDomain(row.domain)
  const derived = await deriveProviderState(row.domain, status, { probe: input.probe, skipProbe: input.skipProbe })

  const updated = await db.churchDomain.update({
    where: { id: row.id },
    data: {
      status: derived.status,
      dnsStatus: derived.dnsStatus,
      sslStatus: derived.sslStatus,
      failureReason: derived.failureReason,
      provider: provider.kind,
      providerRef: status.providerRef ?? row.providerRef,
      providerStatus: serializeProviderStatus(status),
      lastCheckedAt: new Date(),
    },
  })
  // A status change must leave the host cache NOW — including COMPANION
  // hosts of the same church: their cached resolutions carry `primaryDomain`,
  // and a downgraded primary must not receive 308 redirects for up to a
  // cache TTL. Flushing all hosts is cheap (cache refills lazily) and safe.
  if (row.status !== derived.status) invalidateAllHosts()
  await recordAudit({
    churchId: input.churchId,
    actorUserId: input.actorUserId ?? null,
    actorEmail: input.actorEmail ?? 'system:recheck',
    action: 'domain.rechecked',
    entityType: 'church_domain',
    entityId: row.id,
    metadata: { domain: row.domain, from: row.status, to: derived.status },
  })
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
  if (row.status === 'SUSPENDED') {
    return { ok: false, status: 400, error: 'This domain is suspended by the platform operator.', code: 'SUSPENDED' }
  }
  if (row.status === 'ACTIVE') return { ok: true, domain: toView(row) }
  if (!ownershipVerified(row.status) && row.status !== 'FAILED') {
    return { ok: false, status: 400, error: 'Verify domain ownership first.', code: 'NOT_VERIFIED' }
  }
  // Manual confirmation is ONLY legitimate on a self-hosted deployment: the
  // owner controls a server they can point DNS at. On serverless hosting
  // without the provider integration it would fabricate a state the hosting
  // provider cannot deliver (no fixed server address exists); with automated
  // assignment configured, provider truth is required instead.
  const cap = getDomainCapability()
  if (cap.mode === 'unavailable') return unavailableOutcome()
  if (cap.mode === 'managed-auto') {
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

// ---------------------------------------------------------------------------
// Primary domain, removal, operator suspension
// ---------------------------------------------------------------------------

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
  if (!domainsOperable()) return unavailableOutcome()
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
  provider?: ManagedProvider
}): Promise<DomainActionOutcome<{ removed: true }>> {
  const row = await db.churchDomain.findFirst({ where: { id: input.domainId, churchId: input.churchId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }

  const provider = resolveProvider(input.provider)
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
 * Operator suspension (platform admin only — the API route enforces it).
 * Suspended domains stop resolving immediately. The pre-suspension status
 * is stashed inside providerStatus so a resume restores exactly it.
 */
export async function setDomainSuspension(input: {
  domainId: string
  suspended: boolean
  actorUserId: string
  actorEmail: string
}): Promise<DomainActionOutcome<{ domain: DomainView }>> {
  const row = await db.churchDomain.findUnique({ where: { id: input.domainId } })
  if (!row) return { ok: false, status: 404, error: 'Domain not found.', code: 'NOT_FOUND' }

  if (input.suspended) {
    if (row.status === 'SUSPENDED') return { ok: true, domain: toView(row) }
    let stashed: Record<string, unknown> = { mode: 'suspended', suspendedFrom: row.status }
    if (row.providerStatus) {
      try {
        stashed = { ...(JSON.parse(row.providerStatus) as Record<string, unknown>), suspendedFrom: row.status }
      } catch {
        /* keep the simple stash */
      }
    }
    const updated = await db.churchDomain.update({
      where: { id: row.id },
      data: { status: 'SUSPENDED', providerStatus: JSON.stringify(stashed) },
    })
    await recordAudit({
      churchId: row.churchId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      action: 'domain.suspended',
      entityType: 'church_domain',
      entityId: row.id,
      metadata: { domain: row.domain, from: row.status },
    })
    invalidateHost(row.domain)
    invalidateAllHosts()
    return { ok: true, domain: toView(updated) }
  }

  // Resume: restore the stashed status EXACTLY — never a state the domain
  // did not already have (a suspended-unverified row must not resume as
  // verified). Anything unrecognized falls back to the safe floor PENDING.
  if (row.status !== 'SUSPENDED') return { ok: true, domain: toView(row) }
  let restore = 'PENDING'
  let providerStatus: string | null = null
  if (row.providerStatus) {
    try {
      const parsed = JSON.parse(row.providerStatus) as { suspendedFrom?: string; [k: string]: unknown }
      const from = parsed.suspendedFrom
      if (from && isDomainStatus(from) && from !== 'SUSPENDED') {
        restore = from
      }
      delete parsed.suspendedFrom
      providerStatus = JSON.stringify(parsed)
    } catch {
      /* defaults */
    }
  }
  const updated = await db.churchDomain.update({
    where: { id: row.id },
    data: { status: restore, providerStatus },
  })
  await recordAudit({
    churchId: row.churchId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    action: 'domain.resumed',
    entityType: 'church_domain',
    entityId: row.id,
    metadata: { domain: row.domain, to: restore },
  })
  invalidateHost(row.domain)
  invalidateAllHosts()
  return { ok: true, domain: toView(updated) }
}

// ---------------------------------------------------------------------------
// Canonical origin helpers (unchanged behaviour)
// ---------------------------------------------------------------------------

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
