import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch } from '@/lib/api/handler'
import { can } from '@/lib/permissions'

/**
 * Enquiries inbox (contact, prayer, counselling, testimony, follow-up and
 * registration submissions).
 *
 * PRIVACY: prayer and counselling submissions are flagged `isSensitive` and
 * contain highly personal data. Unless the caller holds
 * `enquiries:view_sensitive` those rows are excluded from the result set
 * entirely — not just masked.
 */

type Ctx = { params: Promise<{ slug: string }> }

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED'] as const
const TYPES = ['CONTACT', 'PRAYER', 'COUNSELLING', 'TESTIMONY', 'REGISTRATION', 'FOLLOWUP'] as const

export const GET = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'enquiries:view')

  const url = new URL(req.url)
  const statusParam = (url.searchParams.get('status') ?? '').trim().toUpperCase()
  const typeParam = (url.searchParams.get('type') ?? '').trim().toUpperCase()
  const q = url.searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get('pageSize') ?? '20') || 20))

  const canViewSensitive = can(ctx.role, 'enquiries:view_sensitive')

  const where = {
    churchId: ctx.churchId,
    // Editors (and below) never receive sensitive submissions at all.
    ...(canViewSensitive ? {} : { isSensitive: false }),
    ...((STATUSES as readonly string[]).includes(statusParam) ? { status: statusParam } : {}),
    ...((TYPES as readonly string[]).includes(typeParam) ? { type: typeParam } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { subject: { contains: q } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.formSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.formSubmission.count({ where }),
  ])

  return ok({
    items: rows.map((s) => ({
      id: s.id,
      type: s.type,
      name: s.name,
      email: s.email,
      phone: s.phone,
      subject: s.subject,
      message: s.message,
      isSensitive: s.isSensitive,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    canViewSensitive,
  })
})
