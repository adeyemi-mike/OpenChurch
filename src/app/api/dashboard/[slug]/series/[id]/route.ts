import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { seriesPatchSchema } from '@/lib/validation/entities'
import { recordAudit } from '@/lib/audit'

// See series/route.ts — series audit actions follow the platform's dotted
// convention via local literals (audit.ts is outside this task's scope).
const SERIES_AUDIT = {
  updated: 'series.updated',
  deleted: 'series.deleted',
} as const

type Ctx = { params: Promise<{ slug: string; id: string }> }

async function loadSeries(churchId: string, id: string) {
  const series = await db.sermonSeries.findFirst({ where: { id, churchId } })
  if (!series) throw new ApiError(404, 'Sermon series not found.', 'NOT_FOUND')
  return series
}

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'content:draft')
  const input = await parseBody(req, seriesPatchSchema)
  const series = await loadSeries(ctx.churchId, id)

  const updated = await db.sermonSeries.update({
    where: { id: series.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: SERIES_AUDIT.updated,
    entityType: 'series',
    entityId: series.id,
    metadata: { title: updated.title },
  })

  return ok({
    id: updated.id,
    title: updated.title,
    updatedAt: updated.updatedAt.toISOString(),
  })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'content:draft')
  const series = await loadSeries(ctx.churchId, id)

  // Sermons referencing this series keep their data — the FK is SetNull.
  await db.sermonSeries.delete({ where: { id: series.id } })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: SERIES_AUDIT.deleted,
    entityType: 'series',
    entityId: series.id,
    metadata: { title: series.title },
  })

  return ok({ deleted: true })
})
