import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import { route, ok, parseBody, ApiError } from '@/lib/api/handler'
import { createChurchSchema } from '@/lib/validation/onboarding'
import { slugify } from '@/lib/slug'
import { isReservedSubdomain } from '@/lib/tenancy/resolver'
import { starterPages } from '@/lib/sections/registry'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { toJson } from '@/lib/serialization'

/** How many churches one account may own/create on a deployment.
 *  Operator-configurable via CHURCH_LIMIT_PER_USER (clamped 1–1000). */
function churchLimitPerUser(): number {
  const raw = Number.parseInt(process.env.CHURCH_LIMIT_PER_USER ?? '', 10)
  if (Number.isNaN(raw)) return 10
  return Math.min(1000, Math.max(1, raw))
}

/**
 * Church creation (end of the onboarding wizard).
 * Atomically provisions: church + settings + giving + forms + starter pages +
 * navigation + OWNER membership + optional structure (leaders, ministries,
 * services, locations).
 *
 * Abuse controls: rate limited per IP and capped per account — a single
 * registered user cannot provision unlimited tenants (each church costs
 * ~15 rows + starter pages; unbounded creation is a resource-exhaustion
 * vector).
 */
export const POST = route(async (req: NextRequest) => {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, 'You need to sign in to continue.', 'UNAUTHENTICATED')

  const ipLimit = rateLimit(`onboard-church:${clientIp(req.headers)}`, 5, 60 * 60 * 1000)
  if (!ipLimit.allowed) {
    throw new ApiError(
      429,
      'Too many churches created from this network recently. Please try again later.',
      'RATE_LIMITED'
    )
  }
  const cap = churchLimitPerUser()
  const owned = await db.churchMembership.count({
    where: { userId: user.id, role: 'OWNER' },
  })
  if (owned >= cap) {
    throw new ApiError(
      403,
      `You can create up to ${cap} churches on this deployment. Contact the platform operator if you need more.`,
      'CHURCH_LIMIT'
    )
  }

  const input = await parseBody(req, createChurchSchema)

  // Slug validation & availability
  const slug = input.slug.toLowerCase()
  if (isReservedSubdomain(slug)) {
    throw new ApiError(409, 'That address is reserved. Please choose another.', 'SLUG_TAKEN')
  }
  const existing = await db.church.findUnique({ where: { slug }, select: { id: true } })
  if (existing) throw new ApiError(409, 'That address is already taken.', 'SLUG_TAKEN')

  const isPublishing = input.publish

  // Provision everything inside one transaction: a failure at any point
  // (e.g. a constraint violation) rolls the whole church back — no
  // half-configured tenants can be left behind.
  const church = await db.$transaction(async (tx) => {
    const church = await tx.church.create({
      data: {
        slug,
        name: input.info.name,
        denomination: input.info.denomination || null,
        country: input.info.country,
        region: input.info.region || null,
        city: input.info.city || null,
        address: input.info.address || null,
        phone: input.info.phone || null,
        email: input.info.email || null,
        timezone: input.info.timezone || 'UTC',
        currency: input.info.currency || 'USD',
        isPublished: isPublishing,
        publishedAt: isPublishing ? new Date() : null,
        onboardingCompleted: true,
        onboardingStep: 5,
        status: 'ACTIVE',
      },
    })

    await Promise.all([
      tx.churchMembership.create({ data: { churchId: church.id, userId: user.id, role: 'OWNER' } }),
      tx.churchSettings.create({
        data: {
          churchId: church.id,
          themeKey: input.design.themeKey,
          primaryColor: input.identity.primaryColor,
          secondaryColor: input.identity.secondaryColor,
          fontKey: input.identity.fontKey,
          logoUrl: input.identity.logoUrl || null,
          heroImageUrl: input.identity.heroImageUrl || null,
          defaultSeoTitle: input.info.name,
          defaultSeoDescription: input.info.name + (input.info.city ? ` — ${input.info.city}` : ''),
        },
      }),
      tx.givingSettings.create({
        data: { churchId: church.id, isEnabled: true, mode: 'CUSTOM', customText: '' },
      }),
      // System forms
      tx.form.createMany({
        data: [
          { churchId: church.id, type: 'CONTACT', title: 'Contact us', description: 'We would love to hear from you.', isActive: true, successMessage: 'Thank you! Your message has been received.' },
          { churchId: church.id, type: 'PRAYER', title: 'Prayer request', description: 'Kept confidential — seen only by authorised pastoral staff.', isActive: true, successMessage: 'Your request has been received and will be held in confidence.' },
          { churchId: church.id, type: 'COUNSELLING', title: 'Counselling request', description: 'Request a confidential conversation.', isActive: true, successMessage: 'Thank you. Someone will reach out privately.' },
          { churchId: church.id, type: 'TESTIMONY', title: 'Share a testimony', description: 'Tell us what God is doing.', isActive: true, successMessage: 'Thank you for sharing!' },
          { churchId: church.id, type: 'FOLLOWUP', title: 'New visitor follow-up', description: 'First time with us? Let us know.', isActive: true, successMessage: 'Welcome! We will be in touch.' },
          { churchId: church.id, type: 'REGISTRATION', title: 'Event registration', description: 'Register for an event.', isActive: false, successMessage: 'You are registered!' },
        ],
      }),
      // Giving starter categories
      tx.givingCategory.createMany({
        data: [
          { churchId: church.id, name: 'Tithes', slug: 'tithes', sortOrder: 1 },
          { churchId: church.id, name: 'Offerings', slug: 'offerings', sortOrder: 2 },
          { churchId: church.id, name: 'Missions', slug: 'missions', sortOrder: 3 },
        ],
      }),
    ])

    // Starter pages from the design step
    for (const page of starterPages(church.name)) {
      const sections = toJson(page.sections)
      await tx.websitePage.create({
        data: {
          churchId: church.id,
          title: page.title,
          slug: page.slug,
          isHomePage: page.isHomePage,
          status: 'PUBLISHED',
          draftSections: sections,
          publishedSections: sections,
          publishedAt: isPublishing ? new Date() : null,
          createdById: user.id,
          updatedById: user.id,
        },
      })
    }

    // Default navigation from starter pages
    const nav = [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ]
    await tx.navigationMenu.create({ data: { churchId: church.id, location: 'HEADER', items: toJson(nav) } })
    await tx.navigationMenu.create({ data: { churchId: church.id, location: 'FOOTER', items: toJson(nav) } })

    // Structure step: leaders
    const usedSlugs = new Set<string>()
    for (const [i, l] of input.structure.leaders.entries()) {
      await tx.leader.create({
        data: { churchId: church.id, name: l.name, title: l.title, bio: l.bio, status: 'PUBLISHED', sortOrder: i },
      })
    }
    // Ministries (unique slugs within the church)
    for (const [i, m] of input.structure.ministries.entries()) {
      const base = slugify(m.name) || 'ministry'
      let ministrySlug = base
      let mi = 2
      while (
        usedSlugs.has(ministrySlug) ||
        (await tx.ministry.findFirst({ where: { churchId: church.id, slug: ministrySlug }, select: { id: true } }))
      ) {
        ministrySlug = `${base}-${mi}`
        mi += 1
      }
      usedSlugs.add(ministrySlug)
      await tx.ministry.create({
        data: {
          churchId: church.id,
          name: m.name,
          slug: ministrySlug,
          description: m.description,
          leaderName: m.leaderName || null,
          meetingTime: m.meetingTime || null,
          status: 'PUBLISHED',
          sortOrder: i,
        },
      })
    }
    // Services
    for (const s of input.structure.services) {
      await tx.service.create({
        data: {
          churchId: church.id,
          name: s.name,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime || null,
          notes: s.notes || null,
        },
      })
    }
    // Locations
    for (const [i, l] of input.structure.locations.entries()) {
      await tx.location.create({
        data: {
          churchId: church.id,
          name: l.name,
          address: l.address || null,
          city: l.city || null,
          country: l.country,
          isPrimary: i === 0,
        },
      })
    }

    return church
  })

  await recordAudit({
    churchId: church.id,
    actorUserId: user.id,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.churchCreated,
    entityType: 'church',
    entityId: church.id,
    metadata: { slug: church.slug, published: isPublishing },
  })

  return ok({ slug: church.slug, id: church.id })
})
