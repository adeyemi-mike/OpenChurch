import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody, ApiError } from '@/lib/api/handler'
import { churchSettingsSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'pages:draft')

  const settings = await db.churchSettings.findUnique({ where: { churchId: ctx.churchId } })
  if (!settings) throw new ApiError(404, 'Settings not found.', 'NOT_FOUND')
  return ok(settings)
})

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  // Appearance & website settings are owner/admin territory.
  const ctx = await requireChurch(slug, 'appearance:manage')
  const input = await parseBody(req, churchSettingsSchema)

  const isAppearance =
    input.themeKey !== undefined ||
    input.primaryColor !== undefined ||
    input.secondaryColor !== undefined ||
    input.fontKey !== undefined ||
    input.logoUrl !== undefined ||
    input.heroImageUrl !== undefined

  const settings = await db.churchSettings.update({
    where: { churchId: ctx.churchId },
    data: input,
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: isAppearance ? AUDIT_ACTIONS.appearanceUpdated : AUDIT_ACTIONS.settingsUpdated,
    entityType: 'settings',
    entityId: settings.id,
  })

  return ok(settings)
})
