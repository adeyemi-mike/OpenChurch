import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { route, ok, requirePlatformAdmin, parseBody, ApiError } from '@/lib/api/handler'
import { rateLimit } from '@/lib/rate-limit'
import { recordAudit } from '@/lib/audit'
import { DOMAIN_PLANS, planDomainLimit, normalizePlan } from '@/lib/domains/entitlements'

const planSchema = z.object({
  churchId: z.string().uuid(),
  action: z.literal('set-plan'),
  plan: z.enum(DOMAIN_PLANS),
})

/**
 * Platform-operator plan management: sets a church's subscription plan.
 * Domain limits per plan are read from the environment at enforcement time
 * (DOMAIN_LIMIT_FREE/PAID/PREMIUM) — this endpoint never hardcodes pricing
 * or billing terms; it only records which plan a church is on.
 */
export const POST = route(async (req: NextRequest) => {
  const admin = await requirePlatformAdmin()
  const limit = rateLimit(`admin-plan:${admin.id}`, 60, 60 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(429, 'Too many plan changes — try again later.', 'RATE_LIMITED')
  }
  const { churchId, plan } = await parseBody(req, planSchema)

  const church = await db.church.findUnique({ where: { id: churchId }, select: { id: true, slug: true, plan: true } })
  if (!church) throw new ApiError(404, 'Church not found.', 'NOT_FOUND')

  const updated = await db.church.update({
    where: { id: churchId },
    data: { plan },
    select: { id: true, slug: true, plan: true },
  })
  await recordAudit({
    churchId,
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'church.planChanged',
    entityType: 'church',
    entityId: church.id,
    metadata: { from: normalizePlan(church.plan), to: plan, domainLimit: planDomainLimit(plan) },
  })
  return ok({ church: updated })
})
