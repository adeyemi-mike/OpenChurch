import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { sermonSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

/** Sermons: list (with optional ?q= / ?status=, incl. series title) and create. */

function parseStatusFilter(raw: string | null): string | undefined {
  return raw === 'DRAFT' || raw === 'PUBLISHED' || raw === 'ARCHIVED' ? raw : undefined
}

export const GET = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:draft')

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const status = parseStatusFilter(url.searchParams.get('status'))

  const sermons = await db.sermon.findMany({
    where: {
      churchId: ctx.churchId,
      ...(status ? { status } : {}),
      ...(q ? { title: { contains: q } } : {}),
    },
    orderBy: { preachedAt: 'desc' },
    include: { series: { select: { title: true } } },
  })

  return ok({
    sermons: sermons.map((s) => ({
      id: s.id,
      title: s.title,
      speakerName: s.speakerName,
      preachedAt: s.preachedAt.toISOString(),
      description: s.description,
      scriptureRef: s.scriptureRef,
      seriesId: s.seriesId,
      seriesTitle: s.series?.title ?? null,
      imageUrl: s.imageUrl,
      videoUrl: s.videoUrl,
      audioUrl: s.audioUrl,
      notesUrl: s.notesUrl,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:draft')
  const input = await parseBody(req, sermonSchema)

  const preachedAt = new Date(input.preachedAt)
  if (Number.isNaN(preachedAt.getTime())) {
    throw new ApiError(400, 'Invalid date preached.', 'VALIDATION')
  }

  // Series reference must belong to this church — never trust the client.
  let seriesId: string | null = null
  if (input.seriesId) {
    const series = await db.sermonSeries.findFirst({
      where: { id: input.seriesId, churchId: ctx.churchId },
      select: { id: true },
    })
    if (!series) throw new ApiError(400, 'That sermon series does not exist.', 'BAD_SERIES')
    seriesId = series.id
  }

  // Sermons default to DRAFT; authors can never publish directly.
  const status = ctx.role === 'AUTHOR' ? 'DRAFT' : input.status

  const sermon = await db.sermon.create({
    data: {
      churchId: ctx.churchId,
      title: input.title,
      speakerName: input.speakerName,
      preachedAt,
      description: input.description || null,
      scriptureRef: input.scriptureRef || null,
      seriesId,
      imageUrl: input.imageUrl || null,
      videoUrl: input.videoUrl || null,
      audioUrl: input.audioUrl || null,
      notesUrl: input.notesUrl || null,
      status,
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.sermonCreated,
    entityType: 'sermon',
    entityId: sermon.id,
    metadata: { title: sermon.title },
  })

  return ok(
    {
      id: sermon.id,
      title: sermon.title,
      status: sermon.status,
      createdAt: sermon.createdAt.toISOString(),
    },
    { status: 201 }
  )
})
