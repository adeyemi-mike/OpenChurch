import { type NextRequest } from 'next/server'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { listDomains, addDomain, recheckDomain } from '@/lib/domains/service'
import { getDomainEntitlement } from '@/lib/domains/entitlements'
import { isVercelConfigured, getDomainProvider } from '@/lib/domains/provider'
import { getDomainCapability } from '@/lib/domains/capability'
import { db } from '@/lib/db'

const addSchema = z.object({
  domain: z.string().trim().min(3).max(253),
})

/** Recheck-at-most-this-many stale domains while the page loads. */
const OPPORTUNISTIC_RECHECK_LIMIT = 2
const STALE_AFTER_MS = 5 * 60 * 1000

/**
 * List the church's custom domains (with live status, the deployment's
 * domain capability and the church's plan entitlement, so the UI can stay
 * honest about what is supported and what the plan allows).
 *
 * While loading, at most two provider-assigned domains whose last check is
 * older than 5 minutes are re-checked in the background of the request
 * (provider inspection only — the HTTPS probe runs on the explicit
 * "Check status" action and on the cron recheck).
 */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'domains:manage')

  const provider = getDomainProvider()
  if (provider?.configured && provider.kind === 'vercel') {
    const stale = await db.churchDomain.findMany({
      where: {
        churchId: ctx.churchId,
        provider: 'vercel',
        status: { in: ['PENDING_DNS', 'PENDING_SSL', 'ACTIVE', 'FAILED'] },
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } }],
      },
      orderBy: { lastCheckedAt: 'asc' },
      take: OPPORTUNISTIC_RECHECK_LIMIT,
      select: { id: true },
    })
    for (const row of stale) {
      try {
        await recheckDomain({
          churchId: ctx.churchId,
          domainId: row.id,
          skipProbe: true,
        })
      } catch {
        /* a background refresh must never break the listing */
      }
    }
  }

  const [domains, entitlement] = await Promise.all([
    listDomains(ctx.churchId),
    getDomainEntitlement(ctx.churchId),
  ])
  const capability = getDomainCapability()
  return ok({
    domains,
    provider: {
      vercelConfigured: isVercelConfigured(),
      automated: capability.automated ? 'vercel' : 'manual',
    },
    capability,
    entitlement,
  })
})

/** Add a custom domain (starts TXT ownership verification). */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'domains:manage')

  // Rate limit: 10 domain additions per church per hour.
  const limit = rateLimit(`domains-add:${ctx.churchId}`, 10, 60 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(429, 'Too many domain additions — try again later.', 'RATE_LIMITED')
  }

  const { domain } = await parseBody(req, addSchema)
  const result = await addDomain({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    rawDomain: domain,
  })
  if (!result.ok) throw new ApiError(result.status, result.error, result.code)
  return ok({
    domain: result.domain,
    ...(result.companionSuggestion ? { companionSuggestion: result.companionSuggestion } : {}),
  })
})
