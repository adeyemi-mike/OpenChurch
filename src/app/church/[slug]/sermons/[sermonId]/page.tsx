import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { ChurchSite } from '@/components/site/site-renderer'
import { fromJson } from '@/lib/serialization'
import { absoluteMediaUrl, absoluteUrl, churchSiteUrl, getPublicOrigin } from '@/lib/url'
import { toYouTubeEmbed } from '@/components/site/context'
import { Markdown } from '@/components/site/markdown'
import { resolveCanonicalOrigin, churchCanonicalUrl, getActiveDomainForHost } from '@/lib/domains/service'
import { CalendarDays, Clock3, Download, UserRound, BookOpen, ArrowLeft } from 'lucide-react'

type Params = { params: Promise<{ slug: string; sermonId: string }> }

async function loadSermon(slug: string, sermonId: string) {
  const church = await db.church.findFirst({
    where: { slug, status: 'ACTIVE', isPublished: true },
    include: { settings: true },
  })
  if (!church || !church.settings) return null
  const sermon = await db.sermon.findFirst({
    where: { id: sermonId, churchId: church.id, status: 'PUBLISHED' },
    include: { series: { select: { title: true } } },
  })
  if (!sermon) return null
  return { church, settings: church.settings, sermon }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, sermonId } = await params
  const [found, h] = await Promise.all([loadSermon(slug, sermonId), headers()])
  // notFound() in generateMetadata = deterministic HTTP 404 before the
  // response head flushes (streamed soft-200 otherwise).
  if (!found) notFound()
  const { church, settings, sermon } = found
  const origin = getPublicOrigin(h)
  // Canonical strategy matches the church pages: primary custom domain wins
  // so the sermon detail URL is stable across platform/custom-domain access.
  const canon = await resolveCanonicalOrigin(church.id, origin, h.get('host'))
  const canonical = churchCanonicalUrl(canon, slug, `sermons/${sermon.id}`)
  const title = `${sermon.title} — ${church.name}`
  const description =
    sermon.description?.slice(0, 180) ??
    ([sermon.speakerName, sermon.scriptureRef ? `on ${sermon.scriptureRef}` : null]
      .filter(Boolean)
      .join(' · ') ||
      `A sermon from ${church.name}.`)
  const image =
    absoluteMediaUrl(canon.origin, sermon.imageUrl || settings.heroImageUrl || settings.logoUrl) ??
    absoluteUrl(origin, '/og-default.png')
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: church.name,
      type: 'article',
      images: [{ url: image, width: 1200, height: 630, alt: sermon.title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function SermonDetailPage({ params }: Params) {
  const { slug, sermonId } = await params
  const found = await loadSermon(slug, sermonId)
  if (!found) notFound()
  const { church, settings, sermon } = found

  const h = await headers()
  const servingDomain = await getActiveDomainForHost(church.id, h.get('host'))

  const [headerNav, footerNav] = await Promise.all([
    db.navigationMenu.findUnique({
      where: { churchId_location: { churchId: church.id, location: 'HEADER' } },
    }),
    db.navigationMenu.findUnique({
      where: { churchId_location: { churchId: church.id, location: 'FOOTER' } },
    }),
  ])

  const videoEmbed = toYouTubeEmbed(sermon.videoUrl)
  const hasAudio = Boolean(sermon.audioUrl)
  const hasNotes = Boolean(sermon.notesUrl)
  const hasMedia = Boolean(videoEmbed || hasAudio)
  const preachedAt = sermon.preachedAt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
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
      data={{
        services: [],
        events: [],
        pastEvents: [],
        sermons: [],
        ministries: [],
        leaders: [],
        giving: {
          isEnabled: false,
          isDemo: false,
          mode: 'EXTERNAL',
          provider: 'NONE',
          externalUrl: null,
          bankDetails: null,
          customText: null,
          categories: [],
        },
        contact: {
          name: church.name,
          address: church.address,
          city: church.city,
          country: church.country,
          phone: church.phone,
          email: church.email,
          mapEmbedUrl: null,
          whatsappNumber: null,
        },
        enabledForms: {},
      }}
      preview={false}
      servingDomain={servingDomain}
      sections={[]}
    >
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Link
          href={servingDomain ? '/sermons' : `/church/${church.slug}/sermons`}
          className="inline-flex items-center gap-1.5 text-sm font-medium opacity-70 hover:opacity-100"
        >
          <ArrowLeft className="size-4" aria-hidden /> All sermons
        </Link>

        <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-60">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden /> {preachedAt}
          </span>
          {sermon.series?.title ? <span>{sermon.series.title}</span> : null}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{sermon.title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-75">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-4" aria-hidden /> {sermon.speakerName}
          </span>
          {sermon.scriptureRef ? (
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="size-4" aria-hidden /> {sermon.scriptureRef}
            </span>
          ) : null}
        </p>

        {/* Media — a player is rendered ONLY when a valid source is configured. */}
        <div className="mt-8">
          {videoEmbed ? (
            <div
              className="aspect-video w-full overflow-hidden rounded-[var(--oc-radius)]"
              style={{ background: 'var(--oc-bg-soft)' }}
            >
              <iframe
                src={videoEmbed}
                title={`${sermon.title} — video`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          ) : null}
          {hasAudio ? (
            <div className={videoEmbed ? 'mt-4' : ''}>
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium opacity-70">
                <Clock3 className="size-4" aria-hidden /> Listen to this sermon
              </p>
              <audio controls preload="none" src={sermon.audioUrl as string} className="w-full">
                Your browser does not support embedded audio.
              </audio>
            </div>
          ) : null}
          {!hasMedia ? (
            <p
              className="rounded-[var(--oc-radius)] border border-dashed px-6 py-8 text-center text-sm opacity-70"
              style={{ borderColor: 'var(--oc-border)' }}
            >
              No recording of this sermon is available yet. Come back later, or join us
              in person — all are welcome.
            </p>
          ) : null}
        </div>

        {sermon.description ? (
          <div className="mt-8 space-y-3 leading-relaxed opacity-85">
            <Markdown>{sermon.description}</Markdown>
          </div>
        ) : null}

        {hasNotes ? (
          <a
            href={sermon.notesUrl as string}
            target="_blank"
            rel="noopener noreferrer"
            className="ocs-btn ocs-btn-outline mt-8"
          >
            <Download className="size-4" aria-hidden /> Sermon notes (external download)
          </a>
        ) : null}
      </article>
    </ChurchSite>
  )
}
