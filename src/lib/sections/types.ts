import { z } from 'zod'

/**
 * Section type system.
 *
 * A page is an ordered array of `SectionInstance`s. Each section type has:
 *  - a Zod schema (server-side validation of everything stored in the DB),
 *  - a field definition list (drives the no-code builder form),
 *  - a renderer (src/components/public/sections/*.tsx) shared by the public
 *    website and the builder preview, so preview === production.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const ctaSchema = z.object({
  label: z.string().trim().max(60).default(''),
  href: z.string().trim().max(300).default(''),
})

export const backgroundSchema = z.enum(['plain', 'soft', 'dark', 'accent'])

const sectionBase = {
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  title: z.string().trim().max(120).default(''),
  subtitle: z.string().trim().max(240).default(''),
  background: backgroundSchema.default('plain'),
}

// ---------------------------------------------------------------------------
// Section configs
// ---------------------------------------------------------------------------

export const heroConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('hero'),
  heading: z.string().trim().max(140).default('Welcome to our church'),
  subheading: z.string().trim().max(300).default(''),
  imageUrl: z.string().trim().max(500).default(''),
  imageAlt: z.string().trim().max(200).default(''),
  overlay: z.enum(['light', 'medium', 'dark']).default('medium'),
  align: z.enum(['left', 'center']).default('left'),
  primaryCta: ctaSchema.default({ label: '', href: '' }),
  secondaryCta: ctaSchema.default({ label: '', href: '' }),
})

export const textImageConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('text-image'),
  body: z.string().max(20000).default(''),
  imageUrl: z.string().trim().max(500).default(''),
  imageAlt: z.string().trim().max(200).default(''),
  imageSide: z.enum(['left', 'right']).default('right'),
})

export const galleryConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('gallery'),
  images: z
    .array(
      z.object({
        url: z.string().trim().max(500),
        alt: z.string().trim().max(200).default(''),
        caption: z.string().trim().max(160).default(''),
      })
    )
    .max(12)
    .default([]),
})

export const servicesConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('services'),
  intro: z.string().trim().max(500).default(''),
  showLocation: z.boolean().default(true),
})

export const eventsConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('events'),
  maxItems: z.number().int().min(1).max(9).default(3),
  showPast: z.boolean().default(false),
  cta: ctaSchema.default({ label: '', href: '' }),
})

export const sermonsConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('sermons'),
  maxItems: z.number().int().min(1).max(9).default(3),
  cta: ctaSchema.default({ label: '', href: '' }),
})

export const ministriesConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('ministries'),
  maxItems: z.number().int().min(1).max(12).default(6),
})

export const leadershipConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('leadership'),
  intro: z.string().trim().max(500).default(''),
})

export const videoConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('video'),
  videoUrl: z.string().trim().max(500).default(''),
  caption: z.string().trim().max(240).default(''),
})

export const testimonialsConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('testimonials'),
  items: z
    .array(
      z.object({
        quote: z.string().trim().max(600),
        name: z.string().trim().max(80).default(''),
        role: z.string().trim().max(80).default(''),
      })
    )
    .max(9)
    .default([]),
})

export const ctaConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('cta'),
  body: z.string().trim().max(500).default(''),
  button: ctaSchema.default({ label: '', href: '' }),
  style: z.enum(['solid', 'outline']).default('solid'),
})

export const contactConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('contact'),
  intro: z.string().trim().max(500).default(''),
  showForm: z.boolean().default(true),
  showMap: z.boolean().default(true),
  formType: z.enum(['CONTACT', 'PRAYER', 'COUNSELLING', 'TESTIMONY', 'FOLLOWUP']).default('CONTACT'),
})

export const givingConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('giving'),
  intro: z.string().trim().max(800).default(''),
  showCategories: z.boolean().default(true),
})

export const faqConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('faq'),
  items: z
    .array(
      z.object({
        question: z.string().trim().max(200),
        answer: z.string().trim().max(1200),
      })
    )
    .max(12)
    .default([]),
})

export const richtextConfigSchema = z.object({
  ...sectionBase,
  type: z.literal('richtext'),
  body: z.string().max(40000).default(''),
})

// ---------------------------------------------------------------------------
// Union + helpers
// ---------------------------------------------------------------------------

export const sectionSchema = z.discriminatedUnion('type', [
  heroConfigSchema,
  textImageConfigSchema,
  galleryConfigSchema,
  servicesConfigSchema,
  eventsConfigSchema,
  sermonsConfigSchema,
  ministriesConfigSchema,
  leadershipConfigSchema,
  videoConfigSchema,
  testimonialsConfigSchema,
  ctaConfigSchema,
  contactConfigSchema,
  givingConfigSchema,
  faqConfigSchema,
  richtextConfigSchema,
])

export type SectionInstance = z.infer<typeof sectionSchema>
export type SectionType = SectionInstance['type']

export const SECTION_TYPES: SectionType[] = [
  'hero',
  'text-image',
  'gallery',
  'services',
  'events',
  'sermons',
  'ministries',
  'leadership',
  'video',
  'testimonials',
  'cta',
  'contact',
  'giving',
  'faq',
  'richtext',
]

export const sectionsListSchema = z.array(sectionSchema).max(40)

export type SectionsList = z.infer<typeof sectionsListSchema>

/** Validate a raw JSON payload as a full sections array. */
export function validateSections(raw: unknown): { ok: true; sections: SectionsList } | { ok: false; error: string } {
  const result = sectionsListSchema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    return { ok: false, error: `${issue.path.join('.') || 'sections'}: ${issue.message}` }
  }
  return { ok: true, sections: result.data }
}

/** Data loaded from the tenant DB for dynamic sections, passed to renderers. */
export type SectionPageData = {
  services: {
    id: string
    name: string
    dayOfWeek: number
    startTime: string
    endTime: string | null
    notes: string | null
    locationName: string | null
  }[]
  events: {
    id: string
    title: string
    startsAt: string
    endsAt: string | null
    locationText: string | null
    imageUrl: string | null
    description: string | null
    registrationUrl: string | null
    registrationEnabled: boolean
  }[]
  pastEvents: SectionPageData['events']
  sermons: {
    id: string
    title: string
    speakerName: string
    preachedAt: string
    scriptureRef: string | null
    videoUrl: string | null
    audioUrl: string | null
    notesUrl: string | null
    description: string | null
    imageUrl: string | null
    seriesTitle: string | null
  }[]
  /** All published sermon series of this church (for archive filtering). */
  sermonSeries?: { id: string; title: string }[]
  ministries: {
    id: string
    name: string
    description: string | null
    imageUrl: string | null
    leaderName: string | null
    meetingTime: string | null
    slug: string
  }[]
  leaders: {
    id: string
    name: string
    title: string
    bio: string | null
    imageUrl: string | null
  }[]
  giving: {
    isEnabled: boolean
    isDemo: boolean
    mode: string
    provider: string
    externalUrl: string | null
    bankDetails: string | null
    customText: string | null
    categories: { id: string; name: string; description: string | null }[]
  }
  contact: {
    name: string
    address: string | null
    city: string | null
    country: string | null
    phone: string | null
    email: string | null
    mapEmbedUrl: string | null
    whatsappNumber: string | null
  }
  enabledForms: Record<string, { title: string; description: string | null; successMessage: string | null }>
}
