import { type NextRequest } from 'next/server'
import { route, ok, fail } from '@/lib/api/handler'
import { db } from '@/lib/db'
import { recheckDomain } from '@/lib/domains/service'
import { getDomainProvider } from '@/lib/domains/provider'

/**
 * Background domain recheck (Vercel Cron → vercel.json `crons`).
 *
 * On managed hosting this runs on a schedule (hourly on Pro plans; Vercel's
 * Hobby plan limits cron jobs to once a day — see docs/DEPLOYMENT.md, which
 * also lists the dashboard "Check status" button as the interactive path).
 * On self-hosted installations the operator can call it with the same
 * secret from their own scheduler (curl/systemd timer), or ignore it.
 *
 * Auth: when CRON_SECRET is set, the caller must send
 * `Authorization: Bearer <CRON_SECRET>` (Vercel Cron injects this header
 * automatically for the configured path). Without the secret the endpoint
 * is open — deployments that do not set CRON_SECRET accept that trade-off
 * deliberately: the endpoint is read-mostly, rate-of-change-safe (every
 * action is a provider status re-check, idempotent and audited).
 */
export const GET = route(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return fail(401, 'Unauthorized.', 'CRON_UNAUTHORIZED')
    }
  }

  const provider = getDomainProvider()
  if (!provider?.configured || provider.kind !== 'vercel') {
    // Nothing automated to recheck on this deployment — report honestly.
    return ok({ checked: 0, skipped: 'no-provider-integration' })
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
  return ok({ checked: rows.length, failures, results })
})

// Node runtime: the recheck uses Prisma + outbound fetch + DNS.
export const runtime = 'nodejs'
