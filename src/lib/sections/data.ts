import 'server-only'
import { db } from '@/lib/db'
import type { SectionPageData } from '@/lib/sections/types'

/**
 * Loads the live tenant data that dynamic sections (events, sermons,
 * ministries, leadership, services, giving, contact) render. One query batch
 * per page render; always scoped by churchId (tenant isolation).
 */

export async function loadSectionData(
  churchId: string,
  opts?: { sermonQuery?: string; sermonSeriesId?: string; sermonTake?: number }
): Promise<SectionPageData> {
  const sermonWhere: { churchId: string; status: string; OR?: Array<Record<string, unknown>>; seriesId?: string } = {
    churchId,
    status: 'PUBLISHED',
  }
  if (opts?.sermonSeriesId) sermonWhere.seriesId = opts.sermonSeriesId
  if (opts?.sermonQuery) {
    const q = opts.sermonQuery
    sermonWhere.OR = [
      { title: { contains: q } },
      { speakerName: { contains: q } },
      { scriptureRef: { contains: q } },
      { description: { contains: q } },
    ]
  }

  const [services, upcoming, past, sermons, series, ministries, leaders, givingRow, church, forms] =
    await Promise.all([
      db.service.findMany({
        where: { churchId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: { location: { select: { name: true } } },
      }),
      db.event.findMany({
        where: { churchId, status: 'PUBLISHED', startsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        take: 9,
      }),
      db.event.findMany({
        where: { churchId, status: 'PUBLISHED', startsAt: { lt: new Date() } },
        orderBy: { startsAt: 'desc' },
        take: 6,
      }),
      db.sermon.findMany({
        where: sermonWhere,
        orderBy: { preachedAt: 'desc' },
        take: opts?.sermonTake ?? 9,
        include: { series: { select: { title: true } } },
      }),
      db.sermonSeries.findMany({
        where: { churchId },
        orderBy: { title: 'asc' },
        select: { id: true, title: true },
      }),
      db.ministry.findMany({
        where: { churchId, status: 'PUBLISHED' },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: 12,
      }),
      db.leader.findMany({
        where: { churchId, status: 'PUBLISHED' },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: 12,
      }),
      db.givingSettings.findUnique({ where: { churchId } }),
      db.church.findUniqueOrThrow({
        where: { id: churchId },
        select: {
          name: true,
          address: true,
          city: true,
          country: true,
          phone: true,
          email: true,
          settings: {
            select: { mapEmbedUrl: true, whatsappNumber: true },
          },
        },
      }),
      db.form.findMany({ where: { churchId, isActive: true } }),
    ])

  const categories = await db.givingCategory.findMany({
    where: { churchId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return {
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      notes: s.notes,
      locationName: s.location?.name ?? null,
    })),
    events: upcoming.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt ? e.endsAt.toISOString() : null,
      locationText: e.locationText,
      imageUrl: e.imageUrl,
      description: e.description,
      registrationUrl: e.registrationUrl,
      registrationEnabled: e.registrationEnabled,
    })),
    pastEvents: past.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt ? e.endsAt.toISOString() : null,
      locationText: e.locationText,
      imageUrl: e.imageUrl,
      description: e.description,
      registrationUrl: e.registrationUrl,
      registrationEnabled: e.registrationEnabled,
    })),
    sermons: sermons.map((s) => ({
      id: s.id,
      title: s.title,
      speakerName: s.speakerName,
      preachedAt: s.preachedAt.toISOString(),
      scriptureRef: s.scriptureRef,
      videoUrl: s.videoUrl,
      audioUrl: s.audioUrl,
      notesUrl: s.notesUrl,
      description: s.description,
      imageUrl: s.imageUrl,
      seriesTitle: s.series?.title ?? null,
    })),
    sermonSeries: series,
    ministries: ministries.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      imageUrl: m.imageUrl,
      leaderName: m.leaderName,
      meetingTime: m.meetingTime,
      slug: m.slug,
    })),
    leaders: leaders.map((l) => ({
      id: l.id,
      name: l.name,
      title: l.title,
      bio: l.bio,
      imageUrl: l.imageUrl,
    })),
    giving: {
      isEnabled: givingRow?.isEnabled ?? false,
      isDemo: givingRow?.isDemo ?? false,
      mode: givingRow?.mode ?? 'EXTERNAL',
      provider: givingRow?.provider ?? 'NONE',
      externalUrl: givingRow?.externalUrl ?? null,
      bankDetails: givingRow?.bankDetails ?? null,
      customText: givingRow?.customText ?? null,
      categories: categories.map((c) => ({ id: c.id, name: c.name, description: c.description })),
    },
    contact: {
      name: church.name,
      address: church.address,
      city: church.city,
      country: church.country,
      phone: church.phone,
      email: church.email,
      mapEmbedUrl: church.settings?.mapEmbedUrl ?? null,
      whatsappNumber: church.settings?.whatsappNumber ?? null,
    },
    enabledForms: Object.fromEntries(
      forms.map((f) => [f.type, { title: f.title, description: f.description, successMessage: f.successMessage }])
    ),
  }
}

/** "Next gathering" helper for hero badges. */
export function nextService(services: SectionPageData['services'], from = new Date()) {
  if (services.length === 0) return null
  const dayNow = from.getUTCDay()
  let best: { service: SectionPageData['services'][number]; delta: number } | null = null
  for (const service of services) {
    const delta = (service.dayOfWeek - dayNow + 7) % 7
    if (!best || delta < best.delta) best = { service, delta }
  }
  return best?.service ?? null
}
