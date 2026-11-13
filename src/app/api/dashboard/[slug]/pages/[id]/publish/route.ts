import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { z } from 'zod'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

const bodySchema = z.object({
  action: z.enum(['publish', 'unpublish', 'archive']),
})

/**
 * Page lifecycle: publish promotes the draft snapshot to the live snapshot;
 * unpublish returns the page to draft; archive hides it without deleting.
 */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'pages:manage')
  const { action } = await parseBody(req, bodySchema)

  const page = await db.websitePage.findFirst({ where: { id, churchId: ctx.churchId } })
  if (!page) throw new ApiError(404, 'Page not found.', 'NOT_FOUND')

  if (action === 'publish') {
    const sections = page.draftSections ?? '[]'
    const count = JSON.parse(sections).length
    if (count === 0) {
      throw new ApiError(400, 'Add at least one section before publishing this page.', 'EMPTY_PAGE')
    }
    const updated = await db.websitePage.update({
      where: { id: page.id },
      data: { status: 'PUBLISHED', publishedSections: sections, publishedAt: new Date() },
    })
    await recordAudit({
      churchId: ctx.churchId,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email,
      action: AUDIT_ACTIONS.pagePublished,
      entityType: 'page',
      entityId: page.id,
      metadata: { title: updated.title },
    })
    return ok({ status: updated.status })
  }

  if (action === 'unpublish') {
    const updated = await db.websitePage.update({
      where: { id: page.id },
      data: { status: 'DRAFT' },
    })
    await recordAudit({
      churchId: ctx.churchId,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email,
      action: 'page.unpublished',
      entityType: 'page',
      entityId: page.id,
      metadata: { title: updated.title },
    })
    return ok({ status: updated.status })
  }

  const updated = await db.websitePage.update({
    where: { id: page.id },
    data: { status: 'ARCHIVED' },
  })
  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: 'page.archived',
    entityType: 'page',
    entityId: page.id,
    metadata: { title: updated.title },
  })
  return ok({ status: updated.status })
})
