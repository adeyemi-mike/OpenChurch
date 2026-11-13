import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody } from '@/lib/api/handler'
import { givingCategorySchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { uniqueSlug } from '@/lib/slug'

/** Create a giving category (e.g. Tithes, Offerings, Building Fund). */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'giving:manage')
  const input = await parseBody(req, givingCategorySchema)

  const base = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  // Slugs are unique per church — collect the taken ones up front so the
  // uniqueness check stays synchronous.
  const existing = await db.givingCategory.findMany({
    where: { churchId: ctx.churchId },
    select: { slug: true },
  })
  const taken = new Set(existing.map((c) => c.slug))
  const categorySlug = uniqueSlug(base || 'fund', (s) => taken.has(s))

  const last = await db.givingCategory.findFirst({
    where: { churchId: ctx.churchId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const category = await db.givingCategory.create({
    data: {
      churchId: ctx.churchId,
      name: input.name,
      slug: categorySlug,
      description: input.description || null,
      isActive: input.isActive,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
    select: { id: true, name: true },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.givingUpdated,
    entityType: 'giving_category',
    entityId: category.id,
    metadata: { category: category.name },
  })

  return ok({ id: category.id }, { status: 201 })
})
