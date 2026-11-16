import { type NextRequest } from 'next/server'
import { route, ok, fail } from '@/lib/api/handler'
import { db } from '@/lib/db'
import { recheckDomain } from '@/lib/domains/service'
import { getDomainProvider } from '@/lib/domains/provider'
import { cleanupExpiredAuthArtifacts } from '@/lib/auth/maintenance'
import { rateLimit, clientIp } from '@/lib/rate-limit'

/**
 * Background domain recheck (Vercel Cron → vercel.json `crons`).
 *
 * On managed hosting this runs on a schedule (hourly on Pro plans; Vercel's
 * Hobby plan limits cron jobs to once a day — see docs/DEPLOYMENT.md, which
 * also lists the dashboard "Check status" button as the interactive path).
 * On self-hosted installations the operator can call it with the same
 * secret from their own scheduler (curl/systemd timer), or ignore it.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron injects this
 * header automatically for the configured path). SECURE DEFAULT: when
 * CRON_SECRET is not set the endpoint is DISABLED in production — an
 * unauthenticated caller must never be able to force provider API
 * re-checks (quota burn / status churn). Set CRON_SECRET to enable.
 */
export const GET = route(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return fail(401, 'Unauthorized.', 'CRON_UNAUTHORIZED')
    }
  } else if (process.env.NODE_ENV === 'production') {
    return fail(
      503,
      'Cron endpoint disabled: CRON_SECRET is not configured on this deployment.',
      'CRON_NOT_CONFIGURED'
    )
  }
  // Defence in depth for the unauthenticated (development) case.
  const rl = rateLimit(`cron:${clientIp(req.headers)}`, 6, 60 * 1000)
  if (!rl.allowed) {
    return fail(429, 'Too many requests. Please retry shortly.', 'RATE_LIMITED')
  }

  // Housekeeping piggybacked onto the schedule: expired sessions and stale
  // password-reset tokens are pruned on every run.
  const cleanup = await cleanupExpiredAuthArtifacts().catch(() => null)

  const provider = getDomainProvider()
  if (!provider?.configured || !provider.automated) {
    // Nothing automated to recheck on this deployment — report honestly.
    // (Provider-agnostic: any API-backed adapter sets `automated: true`.)
    return ok({ checked: 0, skipped: 'no-provider-integration', cleanup })
  }

  const stale = new Date(Date.now() - 10 * 60 * 1000)
  const rows = await db.churchDomain.findMany({
    where: {
      provider: 'vercel',
      status: { in: ['PENDING_DNS', 'PENDING_SSL', 'ACTIVE', 'FAILED'] },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: stale } }],
    },
    orderBy: { lastCheckedAt: 'asc' },
    take: 25,
    select: { id: true, churchId: true, domain: true, status: true },
  })

  const results: { domain: string; from: string; to: string }[] = []
  let failures = 0
  for (const row of rows) {
    try {
      const res = await recheckDomain({
        churchId: row.churchId,
        domainId: row.id,
        actorEmail: 'system:cron',
      })
      if (res.ok) {
        results.push({ domain: row.domain, from: row.status, to: res.domain.status })
      } else {
        failures += 1
      }
    } catch {
      failures += 1
    }
  }
  return ok({ checked: rows.length, failures, results, cleanup })
})

// Node runtime: the recheck uses Prisma + outbound fetch + DNS.
export const runtime = 'nodejs'
