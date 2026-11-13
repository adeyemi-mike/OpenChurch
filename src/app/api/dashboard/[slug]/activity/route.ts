import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch } from '@/lib/api/handler'

/** Paginated audit trail for this church (newest first). */
export const GET = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'activity:view')

  const url = new URL(req.url)
  const parsedPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
  const parsedSize = Number.parseInt(url.searchParams.get('pageSize') ?? '25', 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : 1
  const pageSize = Number.isFinite(parsedSize) ? Math.min(100, Math.max(1, parsedSize)) : 25

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where: { churchId: ctx.churchId } }),
    db.auditLog.findMany({
      where: { churchId: ctx.churchId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        actorEmail: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ])

  return ok({
    items: rows.map((r) => ({
      id: r.id,
      actorEmail: r.actorEmail,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
})
