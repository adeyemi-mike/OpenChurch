import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok } from '@/lib/api/handler'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { isReservedSubdomain } from '@/lib/tenancy/resolver'

/** Public availability check for church slugs (used by the onboarding wizard). */
export const GET = route(async (req: NextRequest) => {
  const ip = clientIp(req.headers)
  const limit = rateLimit(`slug-check:${ip}`, 60, 60_000)
  if (!limit.allowed) {
    return ok({ available: false, reason: 'Too many checks — please wait a moment.' })
  }
  const slug = (new URL(req.url).searchParams.get('slug') ?? '').toLowerCase().trim()
  if (slug.length < 2 || slug.length > 40 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return ok({ available: false, reason: 'Use 2–40 characters: lowercase letters, numbers and dashes.' })
  }
  if (isReservedSubdomain(slug)) {
    return ok({ available: false, reason: 'That name is reserved by the platform.' })
  }
  const existing = await db.church.findUnique({ where: { slug }, select: { id: true } })
  return ok({ available: !existing, reason: existing ? 'That name is already taken.' : null })
})
