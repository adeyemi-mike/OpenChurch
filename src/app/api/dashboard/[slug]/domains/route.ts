import { type NextRequest } from 'next/server'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { listDomains, addDomain } from '@/lib/domains/service'
import { isVercelConfigured } from '@/lib/domains/provider'

const addSchema = z.object({
  domain: z.string().trim().min(3).max(253),
})

/** List the church's custom domains (with live status). */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'domains:manage')
  const domains = await listDomains(ctx.churchId)
  return ok({
    domains,
    provider: {
      vercelConfigured: isVercelConfigured(),
      automated: isVercelConfigured() ? 'vercel' : 'manual',
    },
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
  return ok({ domain: result.domain })
})
