import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { locationPatchSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

type Ctx = { params: Promise<{ slug: string; id: string }> }

async function loadLocation(churchId: string, id: string) {
  const location = await db.location.findFirst({ where: { id, churchId } })
  if (!location) throw new ApiError(404, 'Location not found.', 'NOT_FOUND')
  return location
}

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'church:manage_profile')
  const input = await parseBody(req, locationPatchSchema)
  const location = await loadLocation(ctx.churchId, id)

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name
  if (input.address !== undefined) data.address = input.address || null
  if (input.city !== undefined) data.city = input.city || null
  if (input.country !== undefined) data.country = input.country
  if (input.mapUrl !== undefined) data.mapUrl = input.mapUrl || null
  if (input.isPrimary !== undefined) data.isPrimary = input.isPrimary

  // Only one location can be the primary at a time.
  if (input.isPrimary === true) {
    await db.location.updateMany({
      where: { churchId: ctx.churchId, isPrimary: true, NOT: { id: location.id } },
      data: { isPrimary: false },
    })
  }

  const updated = await db.location.update({ where: { id: location.id }, data })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.locationUpdated,
    entityType: 'location',
    entityId: updated.id,
    metadata: { name: updated.name },
  })

  return ok({ id: updated.id, updatedAt: updated.updatedAt.toISOString() })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'church:manage_profile')
  const location = await loadLocation(ctx.churchId, id)

  // Services and events keep their data; their location link is cleared.
  await db.location.delete({ where: { id: location.id } })

  // Never leave the church without a primary location while others exist —
  // promote the first remaining one (name order) automatically.
  if (location.isPrimary) {
    const next = await db.location.findFirst({
      where: { churchId: ctx.churchId },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      select: { id: true },
    })
    if (next) {
      await db.location.update({ where: { id: next.id }, data: { isPrimary: true } })
    }
  }

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.locationUpdated,
    entityType: 'location',
    entityId: location.id,
    metadata: { name: location.name, deleted: true },
  })

  return ok({ deleted: true })
})
