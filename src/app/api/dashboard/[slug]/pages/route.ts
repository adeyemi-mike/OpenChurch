import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { pageCreateSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { isValidPageSlug } from '@/lib/slug'
import { toJson } from '@/lib/serialization'
import { createSection } from '@/lib/sections/registry'

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'pages:draft')

  const pages = await db.websitePage.findMany({
    where: { churchId: ctx.churchId },
    orderBy: [{ isHomePage: 'desc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      isHomePage: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      seoTitle: true,
      seoDescription: true,
    },
  })

  return ok({ pages })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'pages:manage')
  const input = await parseBody(req, pageCreateSchema)

  const desired = input.slug === '/' ? '' : input.slug || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!isValidPageSlug(desired)) {
    throw new ApiError(400, 'Invalid page path — use lowercase words and dashes.', 'BAD_SLUG')
  }

  // Resolve a unique slug within this church.
  let pageSlug = desired
  let attempt = 2
  while (
    await db.websitePage.findFirst({ where: { churchId: ctx.churchId, slug: pageSlug }, select: { id: true } })
  ) {
    pageSlug = `${desired}-${attempt}`
    attempt += 1
    if (attempt > 50) {
      pageSlug = `${desired}-${Math.random().toString(36).slice(2, 6)}`
      break
    }
  }

  // New pages start with one editable rich text section.
  const sections = toJson([{ ...createSection('richtext'), title: input.title }])

  const page = await db.websitePage.create({
    data: {
      churchId: ctx.churchId,
      title: input.title,
      slug: pageSlug,
      isHomePage: false,
      status: 'DRAFT',
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      draftSections: sections,
      createdById: ctx.user.id,
      updatedById: ctx.user.id,
    },
    select: { id: true, title: true, slug: true },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.pageCreated,
    entityType: 'page',
    entityId: page.id,
    metadata: { title: page.title },
  })

  return ok(page, { status: 201 })
})
