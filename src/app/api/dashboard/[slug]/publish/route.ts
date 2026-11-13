import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { z } from 'zod'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

const bodySchema = z.object({ publish: z.boolean() })

/** Publish / unpublish the entire public website. */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'website:publish')
  const { publish } = await parseBody(req, bodySchema)

  if (publish) {
    // Publishing requires at least one published page with content.
    const hasPublishedPage = await db.websitePage.findFirst({
      where: { churchId: ctx.churchId, status: 'PUBLISHED' },
      select: { id: true },
    })
    if (!hasPublishedPage) {
      throw new ApiError(400, 'Publish at least one page before making the website live.', 'NO_PAGES')
    }
  }

  const church = await db.church.update({
    where: { id: ctx.churchId },
    data: {
      isPublished: publish,
      publishedAt: publish ? new Date() : null,
    },
    select: { isPublished: true, publishedAt: true },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: publish ? AUDIT_ACTIONS.websitePublished : AUDIT_ACTIONS.websiteUnpublished,
    entityType: 'church',
    entityId: ctx.churchId,
  })

  return ok(church)
})
