import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { memberRoleSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

type Ctx = { params: Promise<{ slug: string; id: string }> }

async function loadMembership(churchId: string, id: string) {
  const membership = await db.churchMembership.findFirst({
    where: { id, churchId },
    include: { user: { select: { email: true, name: true } } },
  })
  if (!membership) throw new ApiError(404, 'Member not found.', 'NOT_FOUND')
  return membership
}

async function countOwners(churchId: string): Promise<number> {
  return db.churchMembership.count({ where: { churchId, role: 'OWNER' } })
}

/** Change a member's church role. */
export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'church:manage_users')
  const input = await parseBody(req, memberRoleSchema)
  const membership = await loadMembership(ctx.churchId, id)

  // Ownership transfer is a deliberate, separate action — not offered here.
  if (input.role === 'OWNER' && membership.role !== 'OWNER') {
    throw new ApiError(400, 'Transfer ownership is not available in this version.', 'NO_OWNERSHIP_TRANSFER')
  }

  // Safety: demoting the last owner would leave the church unmanageable.
  if (membership.role === 'OWNER' && input.role !== 'OWNER') {
    const owners = await countOwners(ctx.churchId)
    if (owners <= 1) {
      throw new ApiError(400, 'A church must keep at least one owner.', 'LAST_OWNER')
    }
  }

  const updated = await db.churchMembership.update({
    where: { id: membership.id },
    data: { role: input.role },
    select: { id: true, role: true },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.memberRoleChanged,
    entityType: 'membership',
    entityId: membership.id,
    metadata: { email: membership.user.email, role: input.role },
  })

  return ok({ id: updated.id, role: updated.role })
})

/** Remove a member from this church. */
export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'church:manage_users')
  const membership = await loadMembership(ctx.churchId, id)

  // Covers removing yourself too: the only owner removing themselves would
  // lock everyone out of the church's administration.
  if (membership.role === 'OWNER') {
    const owners = await countOwners(ctx.churchId)
    if (owners <= 1) {
      throw new ApiError(400, 'A church must keep at least one owner.', 'LAST_OWNER')
    }
  }

  await db.churchMembership.delete({ where: { id: membership.id } })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.memberRemoved,
    entityType: 'membership',
    entityId: membership.id,
    metadata: { email: membership.user.email },
  })

  return ok({ deleted: true })
})
