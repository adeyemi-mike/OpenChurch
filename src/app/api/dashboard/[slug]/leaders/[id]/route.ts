import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { leaderPatchSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import type { ApiChurchContext } from '@/lib/api/handler'

type Ctx = { params: Promise<{ slug: string; id: string }> }

async function loadLeader(churchId: string, id: string) {
  const leader = await db.leader.findFirst({ where: { id, churchId } })
  if (!leader) throw new ApiError(404, 'Leader not found.', 'NOT_FOUND')
  return leader
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
  const input = await parseBody(req, leaderPatchSchema)
  const leader = await loadLeader(ctx.churchId, id)
  assertCanSetStatus(ctx, input.status)

  const updated = await db.leader.update({
    where: { id: leader.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.leaderUpdated,
    entityType: 'leader',
    entityId: leader.id,
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
  const leader = await loadLeader(ctx.churchId, id)

  await db.leader.delete({ where: { id: leader.id } })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.leaderDeleted,
    entityType: 'leader',
    entityId: leader.id,
    metadata: { title: leader.name },
  })

  return ok({ deleted: true })
})
