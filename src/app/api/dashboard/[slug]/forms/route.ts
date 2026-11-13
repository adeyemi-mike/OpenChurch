import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, parseBody } from '@/lib/api/handler'
import { formConfigSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

/**
 * System form configuration. There are exactly six fixed form types per
 * church; each can be enabled/disabled and its presentation copy edited.
 * Prayer and counselling submissions are always access-restricted and never
 * shown on the public website.
 */

type Ctx = { params: Promise<{ slug: string }> }

const FORM_TYPES = ['CONTACT', 'PRAYER', 'COUNSELLING', 'TESTIMONY', 'REGISTRATION', 'FOLLOWUP'] as const
type FormType = (typeof FORM_TYPES)[number]

// Defaults mirror the provisioning in api/onboarding/church.
const DEFAULTS: Record<FormType, { title: string; description: string; isActive: boolean; successMessage: string }> = {
  CONTACT: {
    title: 'Contact us',
    description: 'We would love to hear from you.',
    isActive: true,
    successMessage: 'Thank you! Your message has been received.',
  },
  PRAYER: {
    title: 'Prayer request',
    description: 'Kept confidential — seen only by authorised pastoral staff.',
    isActive: true,
    successMessage: 'Your request has been received and will be held in confidence.',
  },
  COUNSELLING: {
    title: 'Counselling request',
    description: 'Request a confidential conversation.',
    isActive: true,
    successMessage: 'Thank you. Someone will reach out privately.',
  },
  TESTIMONY: {
    title: 'Share a testimony',
    description: 'Tell us what God is doing.',
    isActive: true,
    successMessage: 'Thank you for sharing!',
  },
  REGISTRATION: {
    title: 'Event registration',
    description: 'Register for an event.',
    isActive: false,
    successMessage: 'You are registered!',
  },
  FOLLOWUP: {
    title: 'New visitor follow-up',
    description: 'First time with us? Let us know.',
    isActive: true,
    successMessage: 'Welcome! We will be in touch.',
  },
}

function toDto(f: {
  id: string
  type: string
  title: string
  description: string | null
  isActive: boolean
  successMessage: string | null
  updatedAt: Date
}) {
  return {
    id: f.id,
    type: f.type,
    title: f.title,
    description: f.description ?? '',
    isActive: f.isActive,
    successMessage: f.successMessage ?? '',
    updatedAt: f.updatedAt.toISOString(),
  }
}

export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'forms:manage')

  const existing = await db.form.findMany({ where: { churchId: ctx.churchId } })
  const have = new Set(existing.map((f) => f.type))

  // Churches provisioned before system forms existed may be missing rows —
  // backfill so the dashboard always shows all six form types.
  const missing = FORM_TYPES.filter((t) => !have.has(t))
  if (missing.length > 0) {
    await db.form.createMany({
      data: missing.map((type) => ({ churchId: ctx.churchId, type, ...DEFAULTS[type] })),
    })
  }

  const forms = await db.form.findMany({ where: { churchId: ctx.churchId } })
  const byType = new Map(forms.map((f) => [f.type, f]))
  return ok({ forms: FORM_TYPES.map((t) => byType.get(t)).map((f) => toDto(f!)) })
})

export const PUT = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'forms:manage')
  const input = await parseBody(req, formConfigSchema)

  const form = await db.form.upsert({
    where: { churchId_type: { churchId: ctx.churchId, type: input.type } },
    update: {
      title: input.title,
      description: input.description,
      isActive: input.isActive,
      successMessage: input.successMessage,
    },
    create: {
      churchId: ctx.churchId,
      type: input.type,
      title: input.title,
      description: input.description,
      isActive: input.isActive,
      successMessage: input.successMessage,
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.formsUpdated,
    entityType: 'form',
    entityId: form.id,
    metadata: { formType: form.type },
  })

  return ok(toDto(form))
})
