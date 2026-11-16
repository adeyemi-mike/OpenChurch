import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { eventPatchSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import type { ApiChurchContext } from '@/lib/api/handler'

type Ctx = { params: Promise<{ slug: string; id: string }> }

async function loadEvent(churchId: string, id: string) {
  const event = await db.event.findFirst({ where: { id, churchId } })
  if (!event) throw new ApiError(404, 'Event not found.', 'NOT_FOUND')
  return event
}

/** Authors may never publish or archive — they submit drafts for review. */
function assertCanSetStatus(ctx: ApiChurchContext, nextStatus: string | undefined) {
  if (ctx.role === 'AUTHOR' && (nextStatus === 'PUBLISHED' || nextStatus === 'ARCHIVED')) {
    throw new ApiError(403, 'Authors submit drafts for review — an editor or admin must publish.', 'FORBIDDEN')
  }
}

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'content:draft')
  const input = await parseBody(req, eventPatchSchema)
  const event = await loadEvent(ctx.churchId, id)
  assertCanSetStatus(ctx, input.status)

  // Merge the incoming dates with the stored ones before validating the range.
  let nextStartsAt = event.startsAt
  if (input.startsAt !== undefined) {
    const d = new Date(input.startsAt)
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid start date/time.', 'VALIDATION')
    nextStartsAt = d
  }
  let nextEndsAt = event.endsAt
  if (input.endsAt !== undefined) {
    if (input.endsAt === '') {
      nextEndsAt = null
    } else {
      const d = new Date(input.endsAt)
      if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid end date/time.', 'VALIDATION')
      nextEndsAt = d
    }
  }
  if (nextEndsAt && nextEndsAt.getTime() <= nextStartsAt.getTime()) {
    throw new ApiError(400, 'The end time must be after the start time.', 'END_BEFORE_START')
  }

  const updated = await db.event.update({
    where: { id: event.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.startsAt !== undefined ? { startsAt: nextStartsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: nextEndsAt } : {}),
      ...(input.locationText !== undefined ? { locationText: input.locationText || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
      ...(input.registrationEnabled !== undefined ? { registrationEnabled: input.registrationEnabled } : {}),
      ...(input.registrationUrl !== undefined ? { registrationUrl: input.registrationUrl || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.eventUpdated,
    entityType: 'event',
    entityId: event.id,
    metadata: { title: updated.title },
  })

  return ok({
    id: updated.id,
    title: updated.title,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  // Deleting published content is an editorial act: authors can draft, but
  // only editors and above can destroy live records (mirrors pages:manage).
  const ctx = await requireChurch(slug, 'content:manage')
  const event = await loadEvent(ctx.churchId, id)

  await db.event.delete({ where: { id: event.id } })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.eventDeleted,
    entityType: 'event',
    entityId: event.id,
    metadata: { title: event.title },
  })

  return ok({ deleted: true })
})
