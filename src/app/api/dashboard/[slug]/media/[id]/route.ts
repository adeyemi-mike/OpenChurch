import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { mediaPatchSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { storage } from '@/lib/storage'

/** Update media metadata (alt text / folder). Files themselves are immutable. */
export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'media:manage')
  const patch = await parseBody(req, mediaPatchSchema)

  // Tenant guard: the asset must belong to THIS church.
  const existing = await db.mediaAsset.findFirst({ where: { id, churchId: ctx.churchId } })
  if (!existing) throw new ApiError(404, 'Media asset not found.', 'NOT_FOUND')

  const updated = await db.mediaAsset.update({
    where: { id },
    data: {
      ...(patch.altText !== undefined ? { altText: patch.altText } : {}),
      ...(patch.folder !== undefined ? { folder: patch.folder } : {}),
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.mediaUpdated,
    entityType: 'media',
    entityId: id,
  })

  return ok({ id: updated.id, altText: updated.altText, folder: updated.folder })
})

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'media:manage')

  const existing = await db.mediaAsset.findFirst({ where: { id, churchId: ctx.churchId } })
  if (!existing) throw new ApiError(404, 'Media asset not found.', 'NOT_FOUND')

  await db.mediaAsset.delete({ where: { id } })
  await storage.delete(`${existing.churchId}/${existing.storedName}`)

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.mediaDeleted,
    entityType: 'media',
    entityId: id,
    metadata: { fileName: existing.fileName },
  })

  return ok({ deleted: true })
})
