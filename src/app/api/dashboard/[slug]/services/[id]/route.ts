import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { servicePatchSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

type Ctx = { params: Promise<{ slug: string; id: string }> }

async function loadService(churchId: string, id: string) {
  const service = await db.service.findFirst({ where: { id, churchId } })
  if (!service) throw new ApiError(404, 'Service not found.', 'NOT_FOUND')
  return service
}

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'church:manage_profile')
  const input = await parseBody(req, servicePatchSchema)
  const service = await loadService(ctx.churchId, id)

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name
  if (input.dayOfWeek !== undefined) data.dayOfWeek = input.dayOfWeek
  if (input.startTime !== undefined) data.startTime = input.startTime
  if (input.endTime !== undefined) data.endTime = input.endTime || null
  if (input.notes !== undefined) data.notes = input.notes || null
  if (input.locationId !== undefined) {
    if (input.locationId) {
      const location = await db.location.findFirst({
        where: { id: input.locationId, churchId: ctx.churchId },
        select: { id: true },
      })
      if (!location) throw new ApiError(400, 'That location does not belong to this church.', 'BAD_LOCATION')
      data.locationId = location.id
    } else {
      data.locationId = null
    }
  }

  const updated = await db.service.update({ where: { id: service.id }, data })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.serviceUpdated,
    entityType: 'service',
    entityId: updated.id,
    metadata: { name: updated.name },
  })

  return ok({ id: updated.id, updatedAt: updated.updatedAt.toISOString() })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'church:manage_profile')
  const service = await loadService(ctx.churchId, id)

  // Services referencing this location are released automatically (SetNull).
  await db.service.delete({ where: { id: service.id } })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.serviceUpdated,
    entityType: 'service',
    entityId: service.id,
    metadata: { name: service.name, deleted: true },
  })

  return ok({ deleted: true })
})
