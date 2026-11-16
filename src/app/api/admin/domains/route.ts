import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { route, ok, requirePlatformAdmin, parseBody, ApiError } from '@/lib/api/handler'
import { rateLimit } from '@/lib/rate-limit'
import { setDomainSuspension } from '@/lib/domains/service'
import { getDomainCapability, domainsOperable } from '@/lib/domains/capability'
import { isVercelConfigured } from '@/lib/domains/provider'

const actionSchema = z.object({
  domainId: z.string().uuid(),
  action: z.enum(['suspend', 'resume']),
})

/**
 * Platform-operator view over ALL custom domains on the deployment, plus
 * the domain kill-switch (suspend/resume). Configuration status for the
 * hosting integration is reported honestly: when the provider variables are
 * not set, managed custom domains are explicitly "not configured" — never
 * implied to work.
 */
export const GET = route(async () => {
  await requirePlatformAdmin()
  const rows = await db.churchDomain.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      domain: true,
      status: true,
      dnsStatus: true,
      sslStatus: true,
      isPrimary: true,
      provider: true,
      providerRef: true,
      failureReason: true,
      lastCheckedAt: true,
      createdAt: true,
      church: { select: { slug: true, name: true, plan: true } },
    },
  })
  const capability = getDomainCapability()
  return ok({
    domains: rows,
    integration: {
      providerConfigured: isVercelConfigured(),
      automated: capability.automated,
      mode: capability.mode,
      summary: capability.summary,
      operable: domainsOperable(capability),
    },
  })
})

/** Suspend / resume a domain (operator kill-switch; audited). */
export const POST = route(async (req: NextRequest) => {
  const admin = await requirePlatformAdmin()
  const limit = rateLimit(`admin-domains:${admin.id}`, 60, 60 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(429, 'Too many domain operations — try again later.', 'RATE_LIMITED')
  }
  const { domainId, action } = await parseBody(req, actionSchema)
  const result = await setDomainSuspension({
    domainId,
    suspended: action === 'suspend',
    actorUserId: admin.id,
    actorEmail: admin.email,
  })
  if (!result.ok) throw new ApiError(result.status, result.error, result.code)
  return ok({ domain: result.domain })
})
