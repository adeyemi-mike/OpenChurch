import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { serviceSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

/** Weekly service times for this church. */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'church:manage_profile')

  const services = await db.service.findMany({
    where: { churchId: ctx.churchId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      notes: true,
      locationId: true,
      location: { select: { name: true } },
    },
  })

  return ok({
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      notes: s.notes,
      locationId: s.locationId,
      locationName: s.location?.name ?? null,
    })),
  })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'church:manage_profile')
  const input = await parseBody(req, serviceSchema)

  let locationId: string | null = null
  if (input.locationId) {
    const location = await db.location.findFirst({
      where: { id: input.locationId, churchId: ctx.churchId },
      select: { id: true },
    })
    if (!location) throw new ApiError(400, 'That location does not belong to this church.', 'BAD_LOCATION')
    locationId = location.id
  }

  const service = await db.service.create({
    data: {
      churchId: ctx.churchId,
      name: input.name,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime || null,
      notes: input.notes || null,
      locationId,
    },
    select: { id: true, name: true },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.serviceUpdated,
    entityType: 'service',
    entityId: service.id,
    metadata: { name: service.name },
  })

  return ok({ id: service.id }, { status: 201 })
})
