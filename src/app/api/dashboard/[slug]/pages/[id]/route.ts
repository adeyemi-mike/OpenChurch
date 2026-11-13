import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { pagePatchSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { validateSections } from '@/lib/sections/types'
import { toJson } from '@/lib/serialization'

type Ctx = { params: Promise<{ slug: string; id: string }> }

async function loadPage(churchId: string, id: string) {
  const page = await db.websitePage.findFirst({ where: { id, churchId } })
  if (!page) throw new ApiError(404, 'Page not found.', 'NOT_FOUND')
  return page
}

export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'pages:draft')
  const page = await loadPage(ctx.churchId, id)
  return ok({
    id: page.id,
    title: page.title,
    slug: page.slug,
    isHomePage: page.isHomePage,
    status: page.status,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    sections: page.draftSections,
    updatedAt: page.updatedAt.toISOString(),
  })
})

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'pages:draft')
  const input = await parseBody(req, pagePatchSchema)
  const page = await loadPage(ctx.churchId, id)

  const data: Record<string, unknown> = { updatedById: ctx.user.id }

  if (input.sections !== undefined) {
    let parsed: unknown
    try {
      parsed = JSON.parse(input.sections)
    } catch {
      throw new ApiError(400, 'Sections payload is not valid JSON.', 'BAD_JSON')
    }
    const result = validateSections(parsed)
    if (!result.ok) {
      throw new ApiError(400, `Invalid sections: ${result.error}`, 'VALIDATION')
    }
    data.draftSections = toJson(result.sections)
  }

  // Page settings (title, path, SEO) require pages:manage — authors edit
  // section content only.
  const settingsChanged =
    input.title !== undefined || input.slug !== undefined || input.seoTitle !== undefined || input.seoDescription !== undefined
  if (settingsChanged) {
    if (ctx.role !== 'OWNER' && ctx.role !== 'ADMIN' && ctx.role !== 'EDITOR') {
      throw new ApiError(403, 'Only editors and above can change the page title, path or SEO settings.', 'FORBIDDEN')
    }
    if (input.title !== undefined) data.title = input.title
    if (input.slug !== undefined && !page.isHomePage) {
      const next = input.slug === '/' ? '' : input.slug
      if (next !== page.slug) {
        const clash = await db.websitePage.findFirst({
          where: { churchId: ctx.churchId, slug: next, NOT: { id: page.id } },
          select: { id: true },
        })
        if (clash) throw new ApiError(409, 'Another page already uses that path.', 'SLUG_TAKEN')
        data.slug = next
      }
    }
    if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle || null
    if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription || null
  }

  const updated = await db.websitePage.update({ where: { id: page.id }, data })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.pageUpdated,
    entityType: 'page',
    entityId: page.id,
    metadata: { title: updated.title },
  })

  return ok({ id: updated.id, updatedAt: updated.updatedAt.toISOString() })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'pages:manage')
  const page = await loadPage(ctx.churchId, id)

  if (page.isHomePage) {
    throw new ApiError(400, 'The homepage cannot be deleted — edit it instead.', 'IS_HOMEPAGE')
  }

  await db.websitePage.delete({ where: { id: page.id } })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.pageDeleted,
    entityType: 'page',
    entityId: page.id,
    metadata: { title: page.title },
  })

  return ok({ deleted: true })
})
