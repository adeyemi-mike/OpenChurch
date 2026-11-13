import { type NextRequest } from 'next/server'
import type { Ministry } from '@prisma/client'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody } from '@/lib/api/handler'
import { ministrySchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { slugifyOr } from '@/lib/slug'

/** Ministries: list (with optional ?q= / ?status=) and create. */

function parseStatusFilter(raw: string | null): string | undefined {
  return raw === 'DRAFT' || raw === 'PUBLISHED' || raw === 'ARCHIVED' ? raw : undefined
}

function toDto(m: Ministry) {
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    description: m.description,
    leaderName: m.leaderName,
    meetingTime: m.meetingTime,
    location: m.location,
    imageUrl: m.imageUrl,
    status: m.status,
    sortOrder: m.sortOrder,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }
}

export const GET = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:draft')

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const status = parseStatusFilter(url.searchParams.get('status'))

  const ministries = await db.ministry.findMany({
    where: {
      churchId: ctx.churchId,
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q } } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return ok({ ministries: ministries.map(toDto) })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:draft')
  const input = await parseBody(req, ministrySchema)

  // Authors always submit drafts — publishing needs an editor or admin.
  const status = ctx.role === 'AUTHOR' ? 'DRAFT' : input.status

  // Ministries carry a public URL slug derived from the name; keep it unique
  // within the church.
  const base = slugifyOr(input.name, 'ministry')
  let ministrySlug = base
  let attempt = 2
  while (
    await db.ministry.findFirst({ where: { churchId: ctx.churchId, slug: ministrySlug }, select: { id: true } })
  ) {
    ministrySlug = `${base}-${attempt}`
    attempt += 1
    if (attempt > 50) {
      ministrySlug = `${base}-${Math.random().toString(36).slice(2, 6)}`
      break
    }
  }

  // New ministries go to the end of the list.
  const sortOrder = await db.ministry.count({ where: { churchId: ctx.churchId } })

  const ministry = await db.ministry.create({
    data: {
      churchId: ctx.churchId,
      name: input.name,
      slug: ministrySlug,
      description: input.description || null,
      leaderName: input.leaderName || null,
      meetingTime: input.meetingTime || null,
      location: input.location || null,
      imageUrl: input.imageUrl || null,
      status,
      sortOrder,
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.ministryCreated,
    entityType: 'ministry',
    entityId: ministry.id,
    metadata: { title: ministry.name },
  })

  return ok(toDto(ministry), { status: 201 })
})
