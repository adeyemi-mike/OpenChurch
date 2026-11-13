import { type NextRequest } from 'next/server'
import type { SermonSeries } from '@prisma/client'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody } from '@/lib/api/handler'
import { seriesSchema } from '@/lib/validation/entities'
import { recordAudit } from '@/lib/audit'

/**
 * Sermon series: list (with optional ?q=) and create.
 *
 * NOTE: AUDIT_ACTIONS has no series.* constants yet (src/lib/audit.ts is
 * outside this task's scope) — we keep the same dotted convention with local
 * literals so the activity log stays consistent.
 */
const SERIES_AUDIT = {
  created: 'series.created',
  updated: 'series.updated',
  deleted: 'series.deleted',
} as const

function toDto(s: SermonSeries) {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    imageUrl: s.imageUrl,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export const GET = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:draft')

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''

  const series = await db.sermonSeries.findMany({
    where: {
      churchId: ctx.churchId,
      ...(q ? { title: { contains: q } } : {}),
    },
    orderBy: { title: 'asc' },
  })

  return ok({ series: series.map(toDto) })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:draft')
  const input = await parseBody(req, seriesSchema)

  const series = await db.sermonSeries.create({
    data: {
      churchId: ctx.churchId,
      title: input.title,
      description: input.description || null,
      imageUrl: input.imageUrl || null,
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: SERIES_AUDIT.created,
    entityType: 'series',
    entityId: series.id,
    metadata: { title: series.title },
  })

  return ok(toDto(series), { status: 201 })
})
