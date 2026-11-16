import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { route, requireChurch, ApiError } from '@/lib/api/handler'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { fromJson } from '@/lib/serialization'

/**
 * Church data export (owner-only): a complete, machine-readable JSON dump of
 * the church's content — the "export your content, no vendor lock-in"
 * promise made on the platform homepage. Media BINARIES are not included;
 * the export lists their metadata and URLs.
 */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'church:manage_settings')

  const church = await db.church.findUnique({
    where: { id: ctx.churchId },
    include: {
      settings: true,
      pages: { orderBy: { createdAt: 'asc' } },
      navigation: true,
      forms: true,
      giving: true,
      givingCategories: { orderBy: { sortOrder: 'asc' } },
      sermons: { orderBy: { preachedAt: 'desc' }, include: { series: true } },
      sermonSeries: true,
      events: { orderBy: { startsAt: 'desc' } },
      ministries: { orderBy: { sortOrder: 'asc' } },
      leaders: { orderBy: { sortOrder: 'asc' } },
      services: { orderBy: { dayOfWeek: 'asc' } },
      locations: true,
      media: true,
      submissions: { orderBy: { createdAt: 'desc' } },
      domains: true,
      memberships: { include: { user: { select: { email: true, name: true } } } },
    },
  })
  if (!church) throw new ApiError(404, 'Church not found.', 'NOT_FOUND')

  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
  const payload = {
    format: 'openchurch.export/v1',
    exportedAt: new Date().toISOString(),
    church: {
      id: church.id,
      slug: church.slug,
      name: church.name,
      denomination: church.denomination,
      country: church.country,
      region: church.region,
      city: church.city,
      address: church.address,
      postalCode: church.postalCode,
      phone: church.phone,
      email: church.email,
      timezone: church.timezone,
      currency: church.currency,
      dateFormat: church.dateFormat,
      description: church.description,
      foundedYear: church.foundedYear,
      isPublished: church.isPublished,
      plan: church.plan,
      settings: church.settings,
      pages: church.pages.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        isHomePage: p.isHomePage,
        status: p.status,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        draftSections: fromJson(p.draftSections, []),
        publishedSections: fromJson(p.publishedSections, []),
        createdAt: iso(p.createdAt),
        updatedAt: iso(p.updatedAt),
        publishedAt: iso(p.publishedAt),
      })),
      navigation: church.navigation.map((n) => ({
        id: n.id,
        location: n.location,
        items: fromJson(n.items, []),
      })),
      forms: church.forms,
      giving: {
        settings: church.giving,
        categories: church.givingCategories,
      },
      sermons: church.sermons.map((s) => ({
        id: s.id,
        title: s.title,
        speakerName: s.speakerName,
        preachedAt: iso(s.preachedAt),
        description: s.description,
        scriptureRef: s.scriptureRef,
        series: s.series ? { id: s.series.id, title: s.series.title } : null,
        imageUrl: s.imageUrl,
        videoUrl: s.videoUrl,
        audioUrl: s.audioUrl,
        notesUrl: s.notesUrl,
        status: s.status,
      })),
      series: church.sermonSeries.map((s) => ({ id: s.id, title: s.title, description: s.description })),
      events: church.events.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: iso(e.startsAt),
        endsAt: iso(e.endsAt),
        locationId: e.locationId,
        description: e.description,
        imageUrl: e.imageUrl,
        registrationUrl: e.registrationUrl,
        status: e.status,
      })),
      ministries: church.ministries,
      leaders: church.leaders,
      services: church.services,
      locations: church.locations,
      media: church.media.map((m) => ({
        id: m.id,
        fileName: m.fileName,
        mimeType: m.mimeType,
        kind: m.kind,
        visibility: m.visibility,
        url: `/api/media/${m.id}/file`,
        createdAt: iso(m.createdAt),
      })),
      submissions: church.submissions.map((s) => ({
        id: s.id,
        type: s.type,
        name: s.name,
        email: s.email,
        phone: s.phone,
        message: s.message,
        isSensitive: s.isSensitive,
        status: s.status,
        createdAt: iso(s.createdAt),
      })),
      domains: church.domains.map((d) => ({
        domain: d.domain,
        type: d.type,
        status: d.status,
        isPrimary: d.isPrimary,
        provider: d.provider,
        dnsStatus: d.dnsStatus,
        sslStatus: d.sslStatus,
        verifiedAt: iso(d.verifiedAt),
        createdAt: iso(d.createdAt),
      })),
      members: church.memberships.map((m) => ({
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        createdAt: iso(m.createdAt),
      })),
    },
  }

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.churchExported,
    entityType: 'church',
    entityId: ctx.churchId,
    metadata: { scope: 'full-content-export' },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="openchurch-${church.slug}-export-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  })
})
