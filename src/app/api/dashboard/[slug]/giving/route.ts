import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody } from '@/lib/api/handler'
import { givingSettingsSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

type GivingSettingsRow = {
  id: string
  isEnabled: boolean
  isDemo: boolean
  mode: string
  provider: string
  externalUrl: string | null
  bankDetails: string | null
  customText: string | null
  updatedAt: Date
}

function settingsDto(s: GivingSettingsRow) {
  return {
    id: s.id,
    isEnabled: s.isEnabled,
    isDemo: s.isDemo,
    mode: s.mode,
    provider: s.provider,
    externalUrl: s.externalUrl,
    bankDetails: s.bankDetails,
    customText: s.customText,
    updatedAt: s.updatedAt.toISOString(),
  }
}

/** Giving configuration + categories (owner/admin territory). */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'giving:manage')

  // Churches created before this module existed may not have a settings row.
  const settings =
    (await db.givingSettings.findUnique({ where: { churchId: ctx.churchId } })) ??
    (await db.givingSettings.create({ data: { churchId: ctx.churchId } }))

  const categories = await db.givingCategory.findMany({
    where: { churchId: ctx.churchId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return ok({
    settings: settingsDto(settings),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt.toISOString(),
    })),
  })
})

export const PUT = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'giving:manage')
  const input = await parseBody(req, givingSettingsSchema)

  const settings = await db.givingSettings.upsert({
    where: { churchId: ctx.churchId },
    update: {
      isEnabled: input.isEnabled,
      isDemo: input.isDemo,
      mode: input.mode,
      provider: input.provider,
      externalUrl: input.externalUrl || null,
      bankDetails: input.bankDetails || null,
      customText: input.customText || null,
    },
    create: {
      churchId: ctx.churchId,
      isEnabled: input.isEnabled,
      isDemo: input.isDemo,
      mode: input.mode,
      provider: input.provider,
      externalUrl: input.externalUrl || null,
      bankDetails: input.bankDetails || null,
      customText: input.customText || null,
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.givingUpdated,
    entityType: 'giving',
    entityId: settings.id,
    metadata: { mode: settings.mode, enabled: settings.isEnabled },
  })

  return ok(settingsDto(settings))
})
