import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody } from '@/lib/api/handler'
import { locationSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

/** Locations / branches of this church. */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'church:manage_profile')

  const locations = await db.location.findMany({
    where: { churchId: ctx.churchId },
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      country: true,
      mapUrl: true,
      isPrimary: true,
    },
  })

  return ok({ locations })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'church:manage_profile')
  const input = await parseBody(req, locationSchema)

  // The first location of a church is always the primary one.
  const existingCount = await db.location.count({ where: { churchId: ctx.churchId } })
  const isFirst = existingCount === 0
  const makePrimary = isFirst || input.isPrimary

  if (makePrimary && !isFirst) {
    await db.location.updateMany({
      where: { churchId: ctx.churchId, isPrimary: true },
      data: { isPrimary: false },
    })
  }

  const location = await db.location.create({
    data: {
      churchId: ctx.churchId,
      name: input.name,
      address: input.address || null,
      city: input.city || null,
      country: input.country,
      mapUrl: input.mapUrl || null,
      isPrimary: makePrimary,
    },
    select: { id: true, name: true, isPrimary: true },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.locationUpdated,
    entityType: 'location',
    entityId: location.id,
    metadata: { name: location.name },
  })

  return ok({ id: location.id, isPrimary: location.isPrimary }, { status: 201 })
})
