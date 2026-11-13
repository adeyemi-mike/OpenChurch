import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { addMemberSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

// Custom display order: owners first, then by join date. SQLite cannot express
// this enum ordering in Prisma, so it is applied in memory (sort is stable and
// the query is already ordered by createdAt).
const ROLE_ORDER: Record<string, number> = { OWNER: 0, ADMIN: 1, EDITOR: 2, AUTHOR: 3 }

/** Members of this church with their user info and role. */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'church:manage_users')

  const memberships = await db.churchMembership.findMany({
    where: { churchId: ctx.churchId },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  memberships.sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9))

  return ok({
    members: memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    })),
  })
})

/**
 * Add an existing OpenChurch account to this church.
 *
 * Honest limitation: email invitations require SMTP which this deployment does
 * not configure, so the person must already have an account.
 */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'church:manage_users')
  const input = await parseBody(req, addMemberSchema)

  if (input.role === 'OWNER') {
    throw new ApiError(400, 'Transfer ownership is not available in this version.', 'NO_OWNERSHIP_TRANSFER')
  }

  const user = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true },
  })
  if (!user) {
    throw new ApiError(
      404,
      'No OpenChurch account uses that email yet. Ask them to register first, then add them here.',
      'USER_NOT_FOUND'
    )
  }

  const existing = await db.churchMembership.findFirst({
    where: { churchId: ctx.churchId, userId: user.id },
    select: { id: true },
  })
  if (existing) {
    throw new ApiError(409, 'That person is already a member of this church.', 'ALREADY_MEMBER')
  }

  const membership = await db.churchMembership.create({
    data: { churchId: ctx.churchId, userId: user.id, role: input.role },
    select: { id: true, role: true },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.memberAdded,
    entityType: 'membership',
    entityId: membership.id,
    metadata: { email: user.email, role: input.role },
  })

  return ok({ id: membership.id, email: user.email, role: membership.role }, { status: 201 })
})
