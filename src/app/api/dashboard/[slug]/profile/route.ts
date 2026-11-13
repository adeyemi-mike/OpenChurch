import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { churchProfileSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

/** Church profile fields (identity, location, contact, locale) — any member can read. */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'pages:draft')

  const church = await db.church.findUnique({ where: { id: ctx.churchId } })
  if (!church) throw new ApiError(404, 'Church not found.', 'NOT_FOUND')

  return ok({
    id: church.id,
    slug: church.slug,
    name: church.name,
    denomination: church.denomination,
    country: church.country,
    region: church.region,
    city: church.city,
    address: church.address,
    postalCode: church.postalCode,
    phone: church.phone,
    email: church.email,
    timezone: church.timezone,
    currency: church.currency,
    dateFormat: church.dateFormat,
    description: church.description,
    foundedYear: church.foundedYear,
  })
})

/** Church profile updates (owner-only via church:manage_profile). */
export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'church:manage_profile')
  const input = await parseBody(req, churchProfileSchema)

  const church = await db.church.update({
    where: { id: ctx.churchId },
    data: input,
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.churchUpdated,
    entityType: 'church',
    entityId: ctx.churchId,
    metadata: { fields: Object.keys(input) },
  })

  return ok({
    id: church.id,
    name: church.name,
    denomination: church.denomination,
    country: church.country,
    region: church.region,
    city: church.city,
    address: church.address,
    postalCode: church.postalCode,
    phone: church.phone,
    email: church.email,
    timezone: church.timezone,
    currency: church.currency,
    dateFormat: church.dateFormat,
    description: church.description,
    foundedYear: church.foundedYear,
  })
})
