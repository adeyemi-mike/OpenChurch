import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { z } from 'zod'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { validatePageReadiness } from '@/lib/publishing/readiness'
import { parseSections } from '@/components/site/site-renderer'

const bodySchema = z.object({
  action: z.enum(['publish', 'unpublish', 'archive']),
})

/**
 * Page lifecycle: publish promotes the draft snapshot to the live snapshot;
 * unpublish returns the page to draft; archive hides it without deleting.
 *
 * Publishing runs a readiness check: BLOCKING issues (unresolved template
 * instructions that would leak editor guidance to the public site) reject
 * the publish with the full issue list; WARNINGS pass through to the
 * dashboard so the church can review them at leisure.
 */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'pages:manage')
  const { action } = await parseBody(req, bodySchema)

  const page = await db.websitePage.findFirst({ where: { id, churchId: ctx.churchId } })
  if (!page) throw new ApiError(404, 'Page not found.', 'NOT_FOUND')

  if (action === 'publish') {
    const sections = parseSections(page.draftSections)
    if (sections.length === 0) {
      throw new ApiError(400, 'Add at least one section before publishing this page.', 'EMPTY_PAGE')
    }
    const readiness = validatePageReadiness(sections)
    if (!readiness.ready) {
      throw new ApiError(
        400,
        `This page is not ready to publish: ${readiness.blocking.map((i) => i.message).join(' ')}`,
        'READINESS_BLOCKED'
      )
    }
    const updated = await db.websitePage.update({
      where: { id: page.id },
      data: {
        status: 'PUBLISHED',
        publishedSections: page.draftSections ?? '[]',
        publishedAt: new Date(),
      },
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
    return ok({ status: updated.status, warnings: readiness.warnings })
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
