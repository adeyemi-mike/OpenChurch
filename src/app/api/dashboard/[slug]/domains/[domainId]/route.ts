import { type NextRequest } from 'next/server'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import {
  verifyDomain,
  connectDomain,
  confirmManualConnection,
  setPrimaryDomain,
  removeDomain,
  regenerateToken,
} from '@/lib/domains/service'

const actionSchema = z.object({
  action: z.enum(['verify', 'connect', 'confirm-manual', 'set-primary', 'regenerate-token']),
})

/**
 * Domain lifecycle actions. Every action is church-scoped (a domainId from
 * another church simply returns 404) and rate-limited per church.
 */
export const POST = route(
  async (req: NextRequest, { params }: { params: Promise<{ slug: string; domainId: string }> }) => {
    const { slug, domainId } = await params
    const ctx = await requireChurch(slug, 'domains:manage')
    const { action } = await parseBody(req, actionSchema)

    // Rate limit: 20 verification/hosting checks per church per hour (DNS
    // and provider lookups must not be hammerable through the dashboard).
    const limit = rateLimit(`domains-action:${ctx.churchId}`, 20, 60 * 60 * 1000)
    if (!limit.allowed) {
      throw new ApiError(429, 'Too many domain checks — try again in a few minutes.', 'RATE_LIMITED')
    }

    const actor = { actorUserId: ctx.user.id, actorEmail: ctx.user.email }
    switch (action) {
      case 'verify': {
        const result = await verifyDomain({ churchId: ctx.churchId, domainId, ...actor })
        if (!result.ok) throw new ApiError(result.status, result.error, result.code)
        return ok({ domain: result.domain })
      }
      case 'connect': {
        const result = await connectDomain({ churchId: ctx.churchId, domainId, ...actor })
        if (!result.ok) throw new ApiError(result.status, result.error, result.code)
        return ok({ domain: result.domain })
      }
      case 'confirm-manual': {
        const result = await confirmManualConnection({ churchId: ctx.churchId, domainId, ...actor })
        if (!result.ok) throw new ApiError(result.status, result.error, result.code)
        return ok({ domain: result.domain })
      }
      case 'set-primary': {
        const result = await setPrimaryDomain({ churchId: ctx.churchId, domainId, ...actor })
        if (!result.ok) throw new ApiError(result.status, result.error, result.code)
        return ok({ domain: result.domain })
      }
      case 'regenerate-token': {
        const result = await regenerateToken({ churchId: ctx.churchId, domainId, ...actor })
        if (!result.ok) throw new ApiError(result.status, result.error, result.code)
        return ok({ domain: result.domain })
      }
    }
  }
)

/** Remove a domain (detaches hosting and stops resolving it). */
export const DELETE = route(
  async (_req: NextRequest, { params }: { params: Promise<{ slug: string; domainId: string }> }) => {
    const { slug, domainId } = await params
    const ctx = await requireChurch(slug, 'domains:manage')
    const result = await removeDomain({
      churchId: ctx.churchId,
      domainId,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email,
    })
    if (!result.ok) throw new ApiError(result.status, result.error, result.code)
    return ok({ removed: true })
  }
)
