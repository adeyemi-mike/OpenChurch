import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { sermonPatchSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import type { ApiChurchContext } from '@/lib/api/handler'

type Ctx = { params: Promise<{ slug: string; id: string }> }

async function loadSermon(churchId: string, id: string) {
  const sermon = await db.sermon.findFirst({ where: { id, churchId } })
  if (!sermon) throw new ApiError(404, 'Sermon not found.', 'NOT_FOUND')
  return sermon
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
  const input = await parseBody(req, sermonPatchSchema)
  const sermon = await loadSermon(ctx.churchId, id)
  assertCanSetStatus(ctx, input.status)

  let preachedAt: Date | undefined
  if (input.preachedAt !== undefined) {
    preachedAt = new Date(input.preachedAt)
    if (Number.isNaN(preachedAt.getTime())) {
      throw new ApiError(400, 'Invalid date preached.', 'VALIDATION')
    }
  }

  // Series reference must belong to this church — never trust the client.
  let seriesId: string | null | undefined
  if (input.seriesId !== undefined) {
    if (input.seriesId === '') {
      seriesId = null // explicit detach
    } else {
      const series = await db.sermonSeries.findFirst({
        where: { id: input.seriesId, churchId: ctx.churchId },
        select: { id: true },
      })
      if (!series) throw new ApiError(400, 'That sermon series does not exist.', 'BAD_SERIES')
      seriesId = series.id
    }
  }

  const updated = await db.sermon.update({
    where: { id: sermon.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.speakerName !== undefined ? { speakerName: input.speakerName } : {}),
      ...(preachedAt !== undefined ? { preachedAt } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.scriptureRef !== undefined ? { scriptureRef: input.scriptureRef || null } : {}),
      ...(seriesId !== undefined ? { seriesId } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
      ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl || null } : {}),
      ...(input.audioUrl !== undefined ? { audioUrl: input.audioUrl || null } : {}),
      ...(input.notesUrl !== undefined ? { notesUrl: input.notesUrl || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.sermonUpdated,
    entityType: 'sermon',
    entityId: sermon.id,
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
  const sermon = await loadSermon(ctx.churchId, id)

  await db.sermon.delete({ where: { id: sermon.id } })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.sermonDeleted,
    entityType: 'sermon',
    entityId: sermon.id,
    metadata: { title: sermon.title },
  })

  return ok({ deleted: true })
})
