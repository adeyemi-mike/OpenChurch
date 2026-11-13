import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { givingCategoryPatchSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

type Ctx = { params: Promise<{ slug: string; id: string }> }

// Adds an explicit reorder action on top of the shared field patch schema.
const patchSchema = givingCategoryPatchSchema.extend({
  move: z.enum(['up', 'down']).optional(),
})

async function loadCategory(churchId: string, id: string) {
  const category = await db.givingCategory.findFirst({ where: { id, churchId } })
  if (!category) throw new ApiError(404, 'Giving category not found.', 'NOT_FOUND')
  return category
}

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'giving:manage')
  const input = await parseBody(req, patchSchema)
  const category = await loadCategory(ctx.churchId, id)

  if (input.move) {
    // Normalise the whole list to a clean 1..n order, then swap neighbours —
    // this also repairs any duplicate sortOrder values from older writes.
    const all = await db.givingCategory.findMany({
      where: { churchId: ctx.churchId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true },
    })
    const index = all.findIndex((c) => c.id === category.id)
    const target = input.move === 'up' ? index - 1 : index + 1
    if (index >= 0 && target >= 0 && target < all.length) {
      const reordered = [...all]
      ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
      await db.$transaction(
        reordered.map((c, i) =>
          db.givingCategory.update({ where: { id: c.id }, data: { sortOrder: i + 1 } })
        )
      )
    }

    await recordAudit({
      churchId: ctx.churchId,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email,
      action: AUDIT_ACTIONS.givingUpdated,
      entityType: 'giving_category',
      entityId: category.id,
      metadata: { category: category.name, moved: input.move },
    })
    return ok({ id: category.id })
  }

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name
  if (input.description !== undefined) data.description = input.description || null
  if (input.isActive !== undefined) data.isActive = input.isActive

  const updated = await db.givingCategory.update({ where: { id: category.id }, data })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.givingUpdated,
    entityType: 'giving_category',
    entityId: updated.id,
    metadata: { category: updated.name },
  })

  return ok({ id: updated.id })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'giving:manage')
  const category = await loadCategory(ctx.churchId, id)

  await db.givingCategory.delete({ where: { id: category.id } })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.givingUpdated,
    entityType: 'giving_category',
    entityId: category.id,
    metadata: { category: category.name, deleted: true },
  })

  return ok({ deleted: true })
})
