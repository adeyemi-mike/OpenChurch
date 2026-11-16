import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { route, ok, requirePlatformAdmin, parseBody, ApiError } from '@/lib/api/handler'
import { rateLimit } from '@/lib/rate-limit'
import { recordAudit } from '@/lib/audit'
import { DOMAIN_PLANS, planDomainLimit, normalizePlan } from '@/lib/domains/entitlements'
import { getDomainProvider } from '@/lib/domains/provider'
import { storage, storageKey } from '@/lib/storage'

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set-plan'),
    churchId: z.string().uuid(),
    plan: z.enum(DOMAIN_PLANS),
  }),
  z.object({
    action: z.literal('delete-church'),
    churchId: z.string().uuid(),
    /** Safety confirmation: the operator must type the church's slug. */
    confirmSlug: z.string().min(1),
  }),
])

/**
 * Platform-operator church management.
 *
 * - set-plan: records a church's subscription plan. Domain limits per plan
 *   are read from the environment at enforcement time
 *   (DOMAIN_LIMIT_FREE/PAID/PREMIUM) — this endpoint never hardcodes pricing
 *   or billing terms.
 *
 * - delete-church: irreversible tenant deletion (data-subject / cleanup
 *   requests). Before the cascading database delete it (1) removes every
 *   provider-assigned custom domain from the hosting provider (best effort —
 *   failures are reported, not hidden) and (2) deletes the church's media
 *   files from storage. Requires typing the church slug as confirmation.
 */
export const POST = route(async (req: NextRequest) => {
  const admin = await requirePlatformAdmin()
  const limit = rateLimit(`admin-plan:${admin.id}`, 60, 60 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(429, 'Too many changes — try again later.', 'RATE_LIMITED')
  }
  const input = await parseBody(req, actionSchema)

  const church = await db.church.findUnique({
    where: { id: input.churchId },
    select: { id: true, slug: true, name: true, plan: true },
  })
  if (!church) throw new ApiError(404, 'Church not found.', 'NOT_FOUND')

  if (input.action === 'set-plan') {
    const updated = await db.church.update({
      where: { id: church.id },
      data: { plan: input.plan },
      select: { id: true, slug: true, plan: true },
    })
    await recordAudit({
      churchId: church.id,
      actorUserId: admin.id,
      actorEmail: admin.email,
      action: 'church.planChanged',
      entityType: 'church',
      entityId: church.id,
      metadata: { from: normalizePlan(church.plan), to: input.plan, domainLimit: planDomainLimit(input.plan) },
    })
    return ok({ church: updated })
  }

  // --- delete-church --------------------------------------------------------
  if (input.confirmSlug !== church.slug) {
    throw new ApiError(
      400,
      'Confirmation failed: the slug you typed does not match this church.',
      'CONFIRM_MISMATCH'
    )
  }

  // 1. Remove provider-assigned custom domains (best effort, honest report).
  const domains = await db.churchDomain.findMany({
    where: { churchId: church.id, provider: { not: null } },
    select: { domain: true, provider: true },
  })
  const provider = getDomainProvider()
  const providerFailures: string[] = []
  if (provider?.configured) {
    for (const d of domains) {
      if (d.provider !== provider.kind) continue // e.g. manual rows need no API call
      try {
        const res = await provider.removeDomain(d.domain)
        if (!res.ok) providerFailures.push(d.domain)
      } catch {
        providerFailures.push(d.domain)
      }
    }
  } else if (domains.length > 0) {
    providerFailures.push(...domains.map((d) => d.domain))
  }

  // 2. Delete media files from storage (rows go with the DB cascade).
  const media = await db.mediaAsset.findMany({
    where: { churchId: church.id },
    select: { storedName: true },
  })
  for (const m of media) {
    await storage.delete(storageKey(church.id, m.storedName)).catch(() => undefined)
  }

  // 3. Cascading database delete (all tenant rows reference churchId).
  await db.church.delete({ where: { id: church.id } })

  await recordAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'church.deleted',
    entityType: 'church',
    entityId: church.id,
    metadata: {
      slug: church.slug,
      name: church.name,
      providerDomains: domains.map((d) => d.domain),
      providerRemovalFailures: providerFailures,
      mediaFilesDeleted: media.length,
    },
  })

  return ok({
    deleted: true,
    slug: church.slug,
    // The operator must clean these up in the provider dashboard — we never
    // pretend a failed provider call succeeded.
    providerRemovalFailures: providerFailures,
  })
})
