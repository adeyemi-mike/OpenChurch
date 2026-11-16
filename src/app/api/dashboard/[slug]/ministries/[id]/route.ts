import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { ministryPatchSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import type { ApiChurchContext } from '@/lib/api/handler'

type Ctx = { params: Promise<{ slug: string; id: string }> }

async function loadMinistry(churchId: string, id: string) {
  const ministry = await db.ministry.findFirst({ where: { id, churchId } })
  if (!ministry) throw new ApiError(404, 'Ministry not found.', 'NOT_FOUND')
  return ministry
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
  const input = await parseBody(req, ministryPatchSchema)
  const ministry = await loadMinistry(ctx.churchId, id)
  assertCanSetStatus(ctx, input.status)

  const updated = await db.ministry.update({
    where: { id: ministry.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.leaderName !== undefined ? { leaderName: input.leaderName || null } : {}),
      ...(input.meetingTime !== undefined ? { meetingTime: input.meetingTime || null } : {}),
      ...(input.location !== undefined ? { location: input.location || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.ministryUpdated,
    entityType: 'ministry',
    entityId: ministry.id,
    metadata: { title: updated.name },
  })

  return ok({
    id: updated.id,
    name: updated.name,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  // Deleting published content is an editorial act: authors can draft, but
  // only editors and above can destroy live records (mirrors pages:manage).
  const ctx = await requireChurch(slug, 'content:manage')
  const ministry = await loadMinistry(ctx.churchId, id)

  await db.ministry.delete({ where: { id: ministry.id } })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.ministryDeleted,
    entityType: 'ministry',
    entityId: ministry.id,
    metadata: { title: ministry.name },
  })

  return ok({ deleted: true })
})
