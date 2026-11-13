import { type NextRequest } from 'next/server'
import type { Event } from '@prisma/client'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { eventSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

/** Events: list (with optional ?q= / ?status=) and create. */

function parseStatusFilter(raw: string | null): string | undefined {
  return raw === 'DRAFT' || raw === 'PUBLISHED' || raw === 'ARCHIVED' ? raw : undefined
}

function toDto(e: Event) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
    locationText: e.locationText,
    imageUrl: e.imageUrl,
    registrationEnabled: e.registrationEnabled,
    registrationUrl: e.registrationUrl,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

function parseDateOrThrow(value: string, label: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `Invalid ${label}.`, 'VALIDATION')
  }
  return date
}

export const GET = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:draft')

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const status = parseStatusFilter(url.searchParams.get('status'))

  const events = await db.event.findMany({
    where: {
      churchId: ctx.churchId,
      ...(status ? { status } : {}),
      ...(q ? { title: { contains: q } } : {}),
    },
    orderBy: { startsAt: 'desc' },
  })

  return ok({ events: events.map(toDto) })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:draft')
  const input = await parseBody(req, eventSchema)

  const startsAt = parseDateOrThrow(input.startsAt, 'start date/time')
  const endsAt = input.endsAt ? parseDateOrThrow(input.endsAt, 'end date/time') : null
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new ApiError(400, 'The end time must be after the start time.', 'END_BEFORE_START')
  }

  // Authors always submit drafts — publishing needs an editor or admin.
  const status = ctx.role === 'AUTHOR' ? 'DRAFT' : input.status

  const event = await db.event.create({
    data: {
      churchId: ctx.churchId,
      title: input.title,
      description: input.description || null,
      startsAt,
      endsAt,
      locationText: input.locationText || null,
      imageUrl: input.imageUrl || null,
      registrationEnabled: input.registrationEnabled,
      registrationUrl: input.registrationUrl || null,
      status,
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.eventCreated,
    entityType: 'event',
    entityId: event.id,
    metadata: { title: event.title },
  })

  return ok(toDto(event), { status: 201 })
})
