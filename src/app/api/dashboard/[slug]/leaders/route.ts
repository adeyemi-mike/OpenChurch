import { type NextRequest } from 'next/server'
import type { Leader } from '@prisma/client'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody } from '@/lib/api/handler'
import { leaderSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

/** Leaders: list (with optional ?q= / ?status=) and create. */

function parseStatusFilter(raw: string | null): string | undefined {
  return raw === 'DRAFT' || raw === 'PUBLISHED' || raw === 'ARCHIVED' ? raw : undefined
}

function toDto(l: Leader) {
  return {
    id: l.id,
    name: l.name,
    title: l.title,
    bio: l.bio,
    imageUrl: l.imageUrl,
    email: l.email,
    phone: l.phone,
    status: l.status,
    sortOrder: l.sortOrder,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }
}

export const GET = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:draft')

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const status = parseStatusFilter(url.searchParams.get('status'))

  const leaders = await db.leader.findMany({
    where: {
      churchId: ctx.churchId,
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q } } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return ok({ leaders: leaders.map(toDto) })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:draft')
  const input = await parseBody(req, leaderSchema)

  // Authors always submit drafts — publishing needs an editor or admin.
  const status = ctx.role === 'AUTHOR' ? 'DRAFT' : input.status

  // New leaders go to the end of the list.
  const sortOrder = await db.leader.count({ where: { churchId: ctx.churchId } })

  const leader = await db.leader.create({
    data: {
      churchId: ctx.churchId,
      name: input.name,
      title: input.title,
      bio: input.bio || null,
      imageUrl: input.imageUrl || null,
      email: input.email || null,
      phone: input.phone || null,
      status,
      sortOrder,
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.leaderCreated,
    entityType: 'leader',
    entityId: leader.id,
    metadata: { title: leader.name },
  })

  return ok(toDto(leader), { status: 201 })
})
