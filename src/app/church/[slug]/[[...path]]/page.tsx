import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { ChurchSite, parseSections } from '@/components/site/site-renderer'
import { loadSectionData } from '@/lib/sections/data'
import { fromJson } from '@/lib/serialization'
import { absoluteMediaUrl, absoluteUrl, churchSiteUrl, getPublicOrigin } from '@/lib/url'
import { Church as ChurchIcon } from 'lucide-react'
import type { SectionsList } from '@/lib/sections/types'
import { sectionHasTemplateInstructions } from '@/lib/sections/template'
import { resolveCanonicalOrigin, churchCanonicalUrl, getActiveDomainForHost } from '@/lib/domains/service'
import { isDemoModeEnabled } from '@/lib/demo-mode'

type Params = {
  params: Promise<{ slug: string; path?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function loadChurch(slug: string) {
  return db.church.findFirst({
    where: { slug, status: 'ACTIVE' },
    include: { settings: true },
  })
}

/**
 * Built-in sermon archive fallback.
 *
 * ROUTING INVARIANT: a church with published sermons must always have an
 * accessible archive route, even when no dedicated "sermons" page record
 * exists (e.g. a church that only ever created starter pages, or whose
 * sermons page is still a draft). The dedicated page record wins when it
 * exists and is published; otherwise this synthetic archive renders.
 * Churches with NO published sermons keep the 404 — no artificial archive.
 */
async function sermonArchiveFallback(churchId: string): Promise<SectionsList | null> {
  const published = await db.sermon.count({ where: { churchId, status: 'PUBLISHED' } })
  if (published === 0) return null
  return [
    {
      id: 'sermon-archive-fallback',
      type: 'sermons',
      enabled: true,
      title: 'Sermons',
      subtitle: '',
      background: 'plain',
      maxItems: 24,
      cta: { label: '', href: '' },
    },
  ]
}

async function resolvePublicPage(churchId: string, pagePath: string) {
  const page = await db.websitePage.findFirst({
    where: { churchId, slug: pagePath, status: 'PUBLISHED' },
  })
  if (page) return { page, fallbackSections: null as SectionsList | null }
  if (pagePath === 'sermons') {
    const fallbackSections = await sermonArchiveFallback(churchId)
    if (fallbackSections) return { page: null, fallbackSections }
  }
  return { page: null, fallbackSections: null }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, path } = await params
  const [church, h] = await Promise.all([loadChurch(slug), headers()])
  if (!church || !church.settings) {
    // Deterministic 404 before any head bytes are flushed (see below).
    notFound()
  }
  const origin = getPublicOrigin(h)
  const requestHost = h.get('host')
  // Canonical strategy: the church's primary custom domain wins (even when
  // the page is visited via the platform slug route) so the two reachable
  // URLs never compete for indexation. Without a custom domain the platform
  // origin is canonical, as before.
  const canon = await resolveCanonicalOrigin(church.id, origin, requestHost)
  const canonicalPath = churchCanonicalUrl(canon, slug, (path ?? []).join('/'))
  const pagePath = (path ?? []).join('/')
  const { page, fallbackSections } = await resolvePublicPage(church.id, pagePath)
  if (!page && !fallbackSections) {
    // notFound() HERE (not in the page component): generateMetadata is
    // awaited before the response head is flushed, so the visitor and
    // crawlers get a real HTTP 404 instead of a streamed soft-200.
    notFound()
  }
  const fallbackTitle = fallbackSections ? 'Sermons' : null
  const title =
    page?.seoTitle ||
    fallbackTitle ||
    (page?.isHomePage ? church.settings.defaultSeoTitle || church.name : `${page?.title} — ${church.name}`)
  // Church sites own their <title> fully — never suffix the platform brand.
  const absoluteTitle = title.includes(church.name) ? title : `${title} — ${church.name}`
  const description =
    page?.seoDescription || church.settings.defaultSeoDescription || church.description || undefined
  // Social sharing image: the church's configured image, resolved to an
  // absolute public URL; falls back to the platform default card.
  const image =
    absoluteMediaUrl(canon.origin, church.settings.heroImageUrl || church.settings.logoUrl) ??
    absoluteUrl(origin, '/og-default.png')
  return {
    title: { absolute: absoluteTitle },
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: absoluteTitle,
      description,
      url: canonicalPath,
      siteName: church.name,
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: church.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: absoluteTitle,
      description,
      images: [image],
    },
    robots:
      church.isPublished && !(church.isDemo && !isDemoModeEnabled())
        ? { index: (page?.status ?? 'PUBLISHED') === 'PUBLISHED', follow: true }
        : { index: false, follow: false },
  }
}

export default async function ChurchSitePage({ params, searchParams }: Params) {
  const { slug, path } = await params
  const church = await loadChurch(slug)

  if (!church || !church.settings) {
    // Real 404 for a nonexistent/suspended church — renders the branded
    // not-found page in this segment's not-found.tsx.
    notFound()
  }

  const settings = church.settings

  // Unpublished website → holding page (owners preview via /preview)
  if (!church.isPublished) {
    return <HoldingPage name={church.name} />
  }

  const pagePath = (path ?? []).join('/')
  const { page, fallbackSections } = await resolvePublicPage(church.id, pagePath)

  if (!page && !fallbackSections) {
    // Real HTTP 404 (not a soft-200): an existing church with a bad page
    // path must not be indexable as duplicate content.
    notFound()
  }

  // Sermon archive filtering (only applies to the sermons archive page).
  const sp = await searchParams
  const rawQuery = sp.q
  const rawSeries = sp.series
  const isSermonsPage = pagePath === 'sermons'
  const sermonQuery = isSermonsPage && typeof rawQuery === 'string' ? rawQuery.trim().slice(0, 80) : undefined
  const sermonSeriesId = isSermonsPage && typeof rawSeries === 'string' && /^[\w-]{1,64}$/.test(rawSeries) ? rawSeries : undefined

  const [data, headerNav, footerNav] = await Promise.all([
    loadSectionData(church.id, {
      sermonQuery: sermonQuery || undefined,
      sermonSeriesId: sermonSeriesId || undefined,
      sermonTake: isSermonsPage ? 24 : 9,
    }),
    db.navigationMenu.findUnique({ where: { churchId_location: { churchId: church.id, location: 'HEADER' } } }),
    db.navigationMenu.findUnique({ where: { churchId_location: { churchId: church.id, location: 'FOOTER' } } }),
  ])

  const sections = parseSections(page?.publishedSections ?? JSON.stringify(fallbackSections))
  // Public pages never even SERIALISE template-instruction sections (filtered
  // before render — absent from both the DOM and the RSC flight payload).
  // Draft preview (/preview) keeps them and the renderer shows an editor-facing
  // hint instead; the renderer also guards independently (defence in depth).
  const publicSections = sections.filter((s) => !sectionHasTemplateInstructions(s))

  // Serving-domain detection: when the request host is one of this church's
  // ACTIVE domains, internal links stay root-relative (clean URLs).
  const pageHeaders = await headers()
  const servingDomain = await getActiveDomainForHost(church.id, pageHeaders.get('host'))

  // Structured data (schema.org Church)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: church.name,
    ...(church.address ? { address: { '@type': 'PostalAddress', streetAddress: church.address, addressLocality: church.city ?? undefined, addressCountry: church.country } } : {}),
    ...(church.phone ? { telephone: church.phone } : {}),
    ...(church.email ? { email: church.email } : {}),
    ...(data.services.length
      ? {
          event: data.services.map((s) => ({
            '@type': 'Event',
            name: s.name,
            eventSchedule: {
              '@type': 'Schedule',
              repeatFrequency: 'P1W',
              byDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][s.dayOfWeek],
              startTime: s.startTime,
            },
          })),
        }
      : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {church.isDemo && isDemoModeEnabled() && (
        <div
          className="fixed bottom-3 left-3 z-50 rounded-full bg-black/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur"
          role="note"
        >
          Demonstration church — content is fictional
        </div>
      )}
      <ChurchSite
        church={{
          slug: church.slug,
          name: church.name,
          city: church.city,
          country: church.country,
          address: church.address,
          phone: church.phone,
          email: church.email,
          timezone: church.timezone,
          isPublished: church.isPublished,
        }}
        settings={settings}
        nav={{
          header: fromJson<{ label: string; href: string }[]>(headerNav?.items, []),
          footer: fromJson<{ label: string; href: string }[]>(footerNav?.items, []),
        }}
        data={data}
        preview={false}
        servingDomain={servingDomain}
        sections={publicSections}
        path={path ?? []}
        sermonQuery={sermonQuery}
        sermonSeriesId={sermonSeriesId}
        // Every non-home section page gets exactly one accessible h1.
        pageHeading={page ? (page.isHomePage ? undefined : page.title) : 'Sermons'}
      />
    </>
  )
}

function HoldingPage({ name }: { name: string }) {
  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 px-4">
      <div className="text-center max-w-md">
        <span className="mx-auto grid place-items-center size-16 rounded-2xl bg-primary/10 text-primary">
          <ChurchIcon className="size-8" aria-hidden />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Our new website is on its way. Please check back soon — or contact us directly for
          service times and information.
        </p>
        <p className="mt-8 text-xs text-muted-foreground">
          Website powered by{' '}
          <Link href="/" className="underline underline-offset-2 hover:text-foreground">
            OpenChurch
          </Link>
        </p>
      </div>
    </div>
  )
}
