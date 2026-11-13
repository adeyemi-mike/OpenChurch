import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { route, ok, requirePlatformAdmin, parseBody, ApiError } from '@/lib/api/handler'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

const statusSchema = z.object({
  churchId: z.string().min(1),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
})

/** Platform-wide stats + the church list, for platform administrators only. */
export const GET = route(async (_req: NextRequest) => {
  await requirePlatformAdmin()

  const [churchesTotal, churchesPublished, users, submissionsNew, submissionsTotal, pages, mediaAssets] =
    await Promise.all([
      db.church.count(),
      db.church.count({ where: { isPublished: true } }),
      db.user.count(),
      db.formSubmission.count({ where: { status: 'NEW' } }),
      db.formSubmission.count(),
      db.websitePage.count(),
      db.mediaAsset.count(),
    ])

  const churches = await db.church.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { memberships: true, pages: true } } },
  })

  return ok({
    stats: {
      churches: churchesTotal,
      published: churchesPublished,
      users,
      submissionsNew,
      submissionsTotal,
      pages,
      mediaAssets,
    },
    churches: churches.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      country: c.country,
      city: c.city,
      isPublished: c.isPublished,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      membershipCount: c._count.memberships,
      pageCount: c._count.pages,
    })),
  })
})

/** Suspend or reactivate a church (platform administrators are trusted). */
export const POST = route(async (req: NextRequest) => {
  const admin = await requirePlatformAdmin()
  const input = await parseBody(req, statusSchema)

  const church = await db.church.findUnique({
    where: { id: input.churchId },
    select: { id: true, slug: true, name: true, status: true },
  })
  if (!church) throw new ApiError(404, 'Church not found.', 'NOT_FOUND')

  if (church.status === input.status) {
    return ok({ id: church.id, status: church.status })
  }

  const updated = await db.church.update({
    where: { id: church.id },
    data: { status: input.status },
    select: { id: true, status: true },
  })

  await recordAudit({
    churchId: church.id,
    actorUserId: admin.id,
    actorEmail: admin.email,
    action:
      input.status === 'SUSPENDED'
        ? AUDIT_ACTIONS.platformChurchSuspended
        : AUDIT_ACTIONS.platformChurchActivated,
    entityType: 'church',
    entityId: church.id,
    metadata: { name: church.name, slug: church.slug, status: input.status },
  })

  return ok({ id: updated.id, status: updated.status })
})
