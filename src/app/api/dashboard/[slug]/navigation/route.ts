import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody } from '@/lib/api/handler'
import { navSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { fromJson, toJson } from '@/lib/serialization'

/**
 * Header & footer navigation menus. When a menu is empty the public site
 * falls back to an automatic menu built from the church's pages.
 */

type NavItem = { label: string; href: string }
type Ctx = { params: Promise<{ slug: string }> }

export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:manage')

  const menus = await db.navigationMenu.findMany({
    where: { churchId: ctx.churchId },
    select: { location: true, items: true },
  })
  const header = menus.find((m) => m.location === 'HEADER')
  const footer = menus.find((m) => m.location === 'FOOTER')

  return ok({
    header: fromJson<NavItem[]>(header?.items, []),
    footer: fromJson<NavItem[]>(footer?.items, []),
  })
})

export const PUT = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'content:manage')
  const input = await parseBody(req, navSchema)

  const items = toJson(input.items)

  const menu = await db.navigationMenu.upsert({
    where: { churchId_location: { churchId: ctx.churchId, location: input.location } },
    update: { items },
    create: { churchId: ctx.churchId, location: input.location, items },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.navigationUpdated,
    entityType: 'navigation',
    entityId: menu.id,
    metadata: { location: input.location, itemCount: input.items.length },
  })

  return ok({ location: input.location, items: input.items })
})
