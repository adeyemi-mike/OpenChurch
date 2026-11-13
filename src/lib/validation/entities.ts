import { z } from 'zod'
import { emailSchema } from '@/lib/validation/onboarding'
import { isValidPageSlug } from '@/lib/slug'

/** Validation schemas for every dashboard mutation. Server-side only truth. */

// --- Pages -----------------------------------------------------------------

export const pageCreateSchema = z.object({
  title: z.string().trim().min(1, 'Give the page a title.').max(120),
  slug: z
    .string()
    .trim()
    .max(100)
    .refine((s) => isValidPageSlug(s === '/' ? '' : s), 'Use lowercase words separated by dashes (e.g. "childrens-church").')
    .optional()
    .default(''),
  seoTitle: z.string().trim().max(70).default(''),
  seoDescription: z.string().trim().max(200).default(''),
})

export const pagePatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  slug: z
    .string()
    .trim()
    .max(100)
    .refine((s) => isValidPageSlug(s === '/' ? '' : s), 'Invalid page path.')
    .optional(),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(200).optional(),
  sections: z.string().max(400_000).optional(), // raw JSON; validated by sectionsListSchema in the handler
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
})

// --- Ministries ------------------------------------------------------------

export const ministrySchema = z.object({
  name: z.string().trim().min(2, 'Give the ministry a name.').max(120),
  description: z.string().trim().max(4000).default(''),
  leaderName: z.string().trim().max(120).default(''),
  meetingTime: z.string().trim().max(120).default(''),
  location: z.string().trim().max(120).default(''),
  imageUrl: z.string().trim().max(500).default(''),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
})

export const ministryPatchSchema = ministrySchema.partial()

// --- Leaders ---------------------------------------------------------------

export const leaderSchema = z.object({
  name: z.string().trim().min(2, 'Enter the name.').max(120),
  title: z.string().trim().min(2, 'Add a role, e.g. Senior Pastor.').max(120),
  bio: z.string().trim().max(4000).default(''),
  imageUrl: z.string().trim().max(500).default(''),
  email: z.union([emailSchema, z.literal('')]).default(''),
  phone: z.string().trim().max(40).default(''),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
})

export const leaderPatchSchema = leaderSchema.partial()

// --- Events ----------------------------------------------------------------

export const eventSchema = z.object({
  title: z.string().trim().min(2, 'Give the event a title.').max(160),
  description: z.string().trim().max(8000).default(''),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  endsAt: z.string().datetime({ offset: true }).or(z.string().min(10)).optional().or(z.literal('')),
  locationText: z.string().trim().max(200).default(''),
  imageUrl: z.string().trim().max(500).default(''),
  registrationEnabled: z.boolean().default(false),
  registrationUrl: z.string().trim().max(500).default(''),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
})

export const eventPatchSchema = eventSchema.partial()

// --- Sermons ---------------------------------------------------------------

/** https(s) URLs only — the public site renders players/links from these. */
const safeHttpUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), {
      message: `${label} must be a valid http(s) URL.`,
    })

/** YouTube (or Vimeo) watch/embed links only — rendered as safe embeds. */
const videoEmbedUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    if (v === '') return true
    try {
      const u = new URL(v)
      const host = u.hostname.replace(/^www\./, '')
      const isYouTube =
        host === 'youtube.com' ||
        host === 'youtu.be' ||
        host === 'm.youtube.com' ||
        host === 'youtube-nocookie.com'
      const isVimeo = host === 'vimeo.com'
      return (isYouTube || isVimeo) && /^https:$/i.test(u.protocol)
    } catch {
      return false
    }
  }, {
    message: 'Use a YouTube or Vimeo video URL (starting with https://).',
  })

export const sermonSchema = z.object({
  title: z.string().trim().min(2, 'Give the sermon a title.').max(200),
  speakerName: z.string().trim().min(2, 'Who preached it?').max(120),
  preachedAt: z.string().min(10),
  description: z.string().trim().max(8000).default(''),
  scriptureRef: z.string().trim().max(200).default(''),
  seriesId: z.string().trim().max(50).optional().or(z.literal('')),
  imageUrl: safeHttpUrl('Image URL').default(''),
  videoUrl: videoEmbedUrl.default(''),
  audioUrl: safeHttpUrl('Audio URL').default(''),
  notesUrl: safeHttpUrl('Sermon notes URL').default(''),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
})

export const sermonPatchSchema = sermonSchema.partial()

export const seriesSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).default(''),
  imageUrl: z.string().trim().max(500).default(''),
})

export const seriesPatchSchema = seriesSchema.partial()

// --- Services & locations --------------------------------------------------

export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Name the service.').max(120),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h).'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal('')),
  notes: z.string().trim().max(200).default(''),
  locationId: z.string().trim().max(50).optional().or(z.literal('')),
})

export const servicePatchSchema = serviceSchema.partial()

export const locationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(240).default(''),
  city: z.string().trim().max(120).default(''),
  country: z.string().trim().length(2).default('NG'),
  mapUrl: z.string().trim().max(500).default(''),
  isPrimary: z.boolean().default(false),
})

export const locationPatchSchema = locationSchema.partial()

// --- Media -----------------------------------------------------------------

export const mediaPatchSchema = z.object({
  altText: z.string().trim().max(200).optional(),
  folder: z.string().trim().max(60).optional(),
})

// --- Navigation ------------------------------------------------------------

/**
 * Safe navigation destinations only. Allowed:
 *   - site-relative paths ("/about", "/")
 *   - in-page anchors ("#visitors")
 *   - absolute http(s) URLs (external church sites)
 * Everything else — javascript:, data:, vbscript:, bare words, traversal —
 * is rejected so a public menu item can never carry an executable or
 * malformed destination.
 */
export function isSafeNavHref(input: string): boolean {
  const href = input.trim()
  if (!href || href.length > 300) return false
  if (/[\u0000-\u001f\u007f]/.test(href)) return false
  if (/^#[\w-]*$/.test(href)) return true
  if (href.startsWith('/')) return !href.includes('..')
  if (/^https?:\/\//i.test(href)) {
    try {
      const u = new URL(href)
      return u.protocol === 'https:' || u.protocol === 'http:'
    } catch {
      return false
    }
  }
  return false
}

export const navItemSchema = z.object({
  label: z.string().trim().min(1, 'Add a label.').max(60),
  href: z
    .string()
    .trim()
    .min(1, 'Add a link.')
    .max(300)
    .refine(isSafeNavHref, 'Use a page path (e.g. /about), an #anchor, or an https:// link.'),
})

export const navSchema = z.object({
  location: z.enum(['HEADER', 'FOOTER']),
  items: z.array(navItemSchema).max(15).default([]),
})

// --- Giving ----------------------------------------------------------------

export const givingSettingsSchema = z.object({
  isEnabled: z.boolean().default(true),
  // Marks the giving details as fictional demonstration content — the public
  // page then labels them clearly instead of implying real payments.
  isDemo: z.boolean().default(false),
  mode: z.enum(['EXTERNAL', 'BANK', 'CUSTOM']).default('EXTERNAL'),
  provider: z.enum(['NONE', 'PAYSTACK', 'STRIPE']).default('NONE'),
  externalUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https?:\/\/.+/i.test(v), {
      message: 'Enter a valid URL starting with http:// or https://.',
    })
    .optional()
    .default(''),
  bankDetails: z.string().trim().max(4000).optional().default(''),
  customText: z.string().trim().max(4000).optional().default(''),
})

export const givingCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(''),
  isActive: z.boolean().default(true),
})

export const givingCategoryPatchSchema = givingCategorySchema.partial()

// --- Church profile & settings ----------------------------------------------

export const churchProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  denomination: z.string().trim().max(120).optional(),
  country: z.string().trim().length(2).optional(),
  region: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  address: z.string().trim().max(240).optional(),
  postalCode: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([emailSchema, z.literal('')]).optional(),
  timezone: z.string().trim().max(60).optional(),
  currency: z.string().trim().max(8).optional(),
  dateFormat: z.enum(['short', 'medium', 'long']).optional(),
  description: z.string().trim().max(2000).optional(),
  foundedYear: z.number().int().min(0).max(2100).optional().nullable(),
})

export const churchSettingsSchema = z.object({
  themeKey: z.string().trim().max(40).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontKey: z.string().trim().max(40).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  heroImageUrl: z.string().trim().max(500).optional(),
  footerText: z.string().trim().max(1000).optional(),
  copyrightLine: z.string().trim().max(200).optional(),
  socialFacebook: z.string().trim().max(300).optional(),
  socialInstagram: z.string().trim().max(300).optional(),
  socialYoutube: z.string().trim().max(300).optional(),
  socialX: z.string().trim().max(300).optional(),
  socialTiktok: z.string().trim().max(300).optional(),
  whatsappNumber: z.string().trim().max(40).optional(),
  defaultSeoTitle: z.string().trim().max(70).optional(),
  defaultSeoDescription: z.string().trim().max(200).optional(),
  mapEmbedUrl: z.string().trim().max(500).optional(),
  announcementText: z.string().trim().max(300).optional(),
  announcementEnabled: z.boolean().optional(),
})

// --- Users & roles ----------------------------------------------------------

export const addMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['ADMIN', 'EDITOR', 'AUTHOR']).or(z.literal('OWNER')),
})

export const memberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'AUTHOR']),
})

// --- Submissions & forms ----------------------------------------------------

export const submissionPatchSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED']).optional(),
})

export const formConfigSchema = z.object({
  type: z.enum(['CONTACT', 'PRAYER', 'COUNSELLING', 'TESTIMONY', 'REGISTRATION', 'FOLLOWUP']),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(''),
  isActive: z.boolean().default(true),
  successMessage: z.string().trim().max(300).default(''),
})

// --- Public form submission (rate-limited, spam-guarded) --------------------

const clean = (max: number) => z.string().trim().min(1).max(max)

export const publicSubmissionSchema = z.object({
  type: z.enum(['CONTACT', 'PRAYER', 'COUNSELLING', 'TESTIMONY', 'FOLLOWUP']),
  name: clean(120),
  email: z.union([emailSchema, z.literal('')]).default(''),
  phone: z.string().trim().max(40).default(''),
  subject: z.string().trim().max(200).default(''),
  message: clean(4000),
  // Spam honeypot: real users never fill this hidden field. The value is
  // ACCEPTED by the schema (bots get a normal-looking success response) and
  // silently discarded by the route handler — nothing is ever stored.
  company: z.string().max(200).optional().default(''),
})
