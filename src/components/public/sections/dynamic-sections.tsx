import Link from 'next/link'
import { MapPin, Clock, ExternalLink, HeartHandshake, CalendarDays } from 'lucide-react'
import { Markdown } from '@/components/site/markdown'
import { SectionShell } from '@/components/public/sections/content-sections'
import type { SiteRenderContext } from '@/components/site/context'
import { siteHref, dateParts, formatEventDate, formatEventTime, toYouTubeEmbed } from '@/components/site/context'
import { safeExternalUrl } from '@/lib/url'
import { DAY_NAMES } from '@/lib/format'
import type { z } from 'zod'
import type {
  servicesConfigSchema,
  eventsConfigSchema,
  sermonsConfigSchema,
  ministriesConfigSchema,
  leadershipConfigSchema,
  givingConfigSchema,
} from '@/lib/sections/types'

export type ServicesSection = z.infer<typeof servicesConfigSchema>
export type EventsSection = z.infer<typeof eventsConfigSchema>
export type SermonsSection = z.infer<typeof sermonsConfigSchema>
export type MinistriesSection = z.infer<typeof ministriesConfigSchema>
export type LeadershipSection = z.infer<typeof leadershipConfigSchema>
export type GivingSection = z.infer<typeof givingConfigSchema>

// ---------------------------------------------------------------------------
// Service schedule
// ---------------------------------------------------------------------------

export function ServicesRenderer({ section, ctx }: { section: ServicesSection; ctx: SiteRenderContext }) {
  const services = ctx.data.services
  return (
    <SectionShell section={section} ctx={ctx}>
      {section.intro ? <p className="max-w-2xl text-lg opacity-70 -mt-4 mb-8">{section.intro}</p> : null}
      {services.length === 0 ? (
        <EmptyNote>No service times have been added yet. Add them in Church Profile → Service times.</EmptyNote>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li
              key={s.id}
              className="ocs-card p-5 flex items-start gap-4"
            >
              <div
                className="grid place-items-center size-14 rounded-[var(--oc-radius)] shrink-0 text-center"
                style={{ background: 'var(--oc-primary)', color: 'var(--oc-primary-fg)' }}
                aria-hidden
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    {DAY_NAMES[s.dayOfWeek].slice(0, 3)}
                  </p>
                  <p className="text-lg font-bold leading-none mt-0.5">{s.startTime}</p>
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{s.name}</p>
                <p className="text-sm opacity-60 mt-0.5">
                  {DAY_NAMES[s.dayOfWeek]}s · {s.startTime}
                  {s.endTime ? `–${s.endTime}` : ''}
                </p>
                {section.showLocation && s.locationName ? (
                  <p className="text-sm opacity-60 mt-1 inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden /> {s.locationName}
                  </p>
                ) : null}
                {s.notes ? <p className="text-sm opacity-60 mt-1">{s.notes}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export function EventsRenderer({ section, ctx }: { section: EventsSection; ctx: SiteRenderContext }) {
  const events = section.showPast ? ctx.data.pastEvents : ctx.data.events
  const list = events.slice(0, section.maxItems)
  return (
    <SectionShell section={section} ctx={ctx}>
      {list.length === 0 ? (
        <EmptyNote>
          {section.showPast ? 'No past events to show yet.' : 'No upcoming events — check back soon.'}
        </EmptyNote>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => {
            // Dates render in the church's own timezone and locale — the
            // displayed weekday always matches the intended local date, and
            // the year is always visible.
            const when = { timezone: ctx.church.timezone, country: ctx.church.country }
            const d = dateParts(e.startsAt, when)
            const registrationUrl = safeExternalUrl(e.registrationUrl)
            return (
              <li key={e.id} className="ocs-card flex flex-col">
                {e.imageUrl ? (
                   
                  <img
                    src={e.imageUrl}
                    alt={e.title}
                    loading="lazy"
                    className={`w-full aspect-[16/9] object-cover ${section.showPast ? 'grayscale-[0.5]' : ''}`}
                  />
                ) : null}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="grid place-items-center size-12 rounded-lg text-center shrink-0"
                      style={{ background: 'var(--oc-primary)', color: 'var(--oc-primary-fg)' }}
                      aria-hidden
                    >
                      <div>
                        <p className="text-sm font-bold leading-none">{d.day}</p>
                        <p className="text-[10px] uppercase font-semibold opacity-80">{d.month}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-snug">{e.title}</h3>
                      <p className="text-sm opacity-60 mt-1">
                        {formatEventDate(e.startsAt, when)} · {formatEventTime(e.startsAt, when)}
                      </p>
                    </div>
                  </div>
                  {e.description ? (
                    <p className="mt-3 text-sm leading-relaxed opacity-75 line-clamp-3">{e.description}</p>
                  ) : null}
                  <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                    {e.locationText ? (
                      <span className="text-sm opacity-60 inline-flex items-center gap-1 min-w-0">
                        <MapPin className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{e.locationText}</span>
                      </span>
                    ) : (
                      <span />
                    )}
                    {e.registrationEnabled && registrationUrl ? (
                      <a
                        href={registrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ocs-btn ocs-btn-primary !min-h-0 !py-2 !px-4 text-sm"
                      >
                        Register
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {section.cta.label ? (
        <div className="mt-8 text-center">
          <Link href={siteHref(ctx, section.cta.href)} className="ocs-btn ocs-btn-outline">
            {section.cta.label}
          </Link>
        </div>
      ) : null}
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Sermons
// ---------------------------------------------------------------------------

export function SermonsRenderer({ section, ctx }: { section: SermonsSection; ctx: SiteRenderContext }) {
  const sermons = ctx.data.sermons.slice(0, section.maxItems)
  const seriesOptions = ctx.data.sermonSeries ?? []
  const isArchivePath = ctx.path?.[0] === 'sermons'
  return (
    <SectionShell section={section} ctx={ctx}>
      {isArchivePath ? (
        <form
          action={`/church/${ctx.church.slug}/sermons`}
          method="get"
          className="mb-8 flex flex-wrap items-end gap-3"
          role="search"
          aria-label="Search sermons"
        >
          <div className="min-w-[200px] flex-1">
            <label htmlFor="sermon-q" className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-60">
              Search
            </label>
            <input
              id="sermon-q"
              name="q"
              type="search"
              defaultValue={ctx.sermonQuery ?? ''}
              placeholder="Title, speaker, scripture…"
              className="ocs-input w-full"
            />
          </div>
          {seriesOptions.length > 0 ? (
            <div className="min-w-[160px]">
              <label htmlFor="sermon-series" className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-60">
                Series
              </label>
              <select id="sermon-series" name="series" defaultValue={ctx.sermonSeriesId ?? ''} className="ocs-input w-full">
                <option value="">All series</option>
                {seriesOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <button type="submit" className="ocs-btn ocs-btn-primary">
            Apply
          </button>
          {ctx.sermonQuery || ctx.sermonSeriesId ? (
            <a href={`/church/${ctx.church.slug}/sermons`} className="ocs-btn ocs-btn-outline">
              Clear
            </a>
          ) : null}
        </form>
      ) : null}
      {sermons.length === 0 ? (
        <EmptyNote>
          {isArchivePath && (ctx.sermonQuery || ctx.sermonSeriesId)
            ? 'No sermons match your search. Try different keywords or clear the filters.'
            : 'No sermons published yet. Add your first sermon under Sermons.'}
        </EmptyNote>
      ) : (
        <ul className="grid gap-6 md:grid-cols-3">
          {sermons.map((s) => (
            <li key={s.id} className="ocs-card flex flex-col">
              <Link href={`/church/${ctx.church.slug}/sermons/${s.id}`} className="block">
                <div className="aspect-video w-full" style={{ background: 'var(--oc-bg-soft)' }}>
                  {toYouTubeEmbed(s.videoUrl) ? (
                    <iframe
                      src={toYouTubeEmbed(s.videoUrl) as string}
                      title={s.title}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  ) : s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.title} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center opacity-40" aria-hidden>
                      <HeartHandshake className="size-8" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-5 flex flex-col flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-50">
                  {new Date(s.preachedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {s.seriesTitle ? ` · ${s.seriesTitle}` : ''}
                </p>
                <h3 className="font-semibold mt-1.5 leading-snug">
                  <Link
                    href={`/church/${ctx.church.slug}/sermons/${s.id}`}
                    className="hover:underline underline-offset-4 decoration-2"
                    style={{ textDecorationColor: 'var(--oc-primary)' }}
                  >
                    {s.title}
                  </Link>
                </h3>
                <p className="text-sm opacity-60 mt-1">{s.speakerName}</p>
                {s.scriptureRef ? (
                  <p
                    className="inline-flex mt-3 text-xs font-semibold px-2.5 py-1 rounded-full self-start"
                    style={{ background: 'var(--oc-bg-soft)' }}
                  >
                    {s.scriptureRef}
                  </p>
                ) : null}
                <p className="mt-auto pt-4">
                  <Link
                    href={`/church/${ctx.church.slug}/sermons/${s.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold"
                    style={{ color: 'var(--oc-primary)' }}
                  >
                    Listen &amp; view details
                    <span aria-hidden>→</span>
                  </Link>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {section.cta.label ? (
        <div className="mt-8 text-center">
          <Link href={siteHref(ctx, section.cta.href)} className="ocs-btn ocs-btn-outline">
            {section.cta.label}
          </Link>
        </div>
      ) : null}
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Ministries
// ---------------------------------------------------------------------------

export function MinistriesRenderer({ section, ctx }: { section: MinistriesSection; ctx: SiteRenderContext }) {
  const ministries = ctx.data.ministries.slice(0, section.maxItems)
  return (
    <SectionShell section={section} ctx={ctx}>
      {ministries.length === 0 ? (
        <EmptyNote>No ministries added yet. Add them under Ministries in the dashboard.</EmptyNote>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ministries.map((m) => (
            <li key={m.id} className="ocs-card flex flex-col">
              {m.imageUrl ? (
                 
                <img src={m.imageUrl} alt={m.name} loading="lazy" className="w-full aspect-[16/10] object-cover" />
              ) : null}
              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-semibold">{m.name}</h3>
                {m.description ? (
                  <p className="mt-2 text-sm leading-relaxed opacity-75 line-clamp-4">{m.description}</p>
                ) : null}
                <div className="mt-auto pt-4 space-y-1.5 text-sm opacity-70">
                  {m.leaderName ? (
                    <p className="inline-flex items-center gap-1.5">
                      <HeartHandshake className="size-3.5" aria-hidden /> Led by {m.leaderName}
                    </p>
                  ) : null}
                  {m.meetingTime ? (
                    <p className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5" aria-hidden /> {m.meetingTime}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Leadership
// ---------------------------------------------------------------------------

export function LeadershipRenderer({ section, ctx }: { section: LeadershipSection; ctx: SiteRenderContext }) {
  const leaders = ctx.data.leaders
  return (
    <SectionShell section={section} ctx={ctx}>
      {section.intro ? <p className="max-w-2xl text-lg opacity-70 -mt-4 mb-8">{section.intro}</p> : null}
      {leaders.length === 0 ? (
        <EmptyNote>No leaders have been added yet. Add them under Leadership in the dashboard.</EmptyNote>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {leaders.map((l) => (
            <li key={l.id} className="ocs-card p-6 text-center flex flex-col items-center">
              {l.imageUrl ? (
                 
                <img
                  src={l.imageUrl}
                  alt={l.name}
                  loading="lazy"
                  className="size-24 rounded-full object-cover"
                  style={{ boxShadow: 'var(--oc-card)' }}
                />
              ) : (
                <span
                  className="grid place-items-center size-24 rounded-full text-2xl font-semibold"
                  style={{ background: 'var(--oc-bg-soft)' }}
                  aria-hidden
                >
                  {l.name
                    .split(' ')
                    .filter((w) => !w.includes('.'))
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')}
                </span>
              )}
              <h3 className="font-semibold mt-4">{l.name}</h3>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--oc-secondary)' }}>
                {l.title}
              </p>
              {l.bio ? <p className="text-sm opacity-70 mt-2 leading-relaxed line-clamp-4">{l.bio}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Giving
// ---------------------------------------------------------------------------

export function GivingRenderer({ section, ctx }: { section: GivingSection; ctx: SiteRenderContext }) {
  const giving = ctx.data.giving
  return (
    <SectionShell section={section} ctx={ctx}>
      {giving.isDemo ? (
        <p
          role="note"
          className="mb-8 rounded-[var(--oc-radius)] px-4 py-3 text-sm"
          style={{ background: 'var(--oc-bg-soft)', color: 'var(--oc-secondary)' }}
        >
          <strong>Demonstration content.</strong> This church&apos;s giving details are
          fictional placeholders used to show how the platform works — no real
          payments can be made here.
        </p>
      ) : null}
      <div className="grid lg:grid-cols-2 gap-10 items-start">
        <div>
          {section.intro ? <Markdown>{section.intro}</Markdown> : null}
          {giving.mode === 'BANK' && giving.bankDetails ? (
            <div
              className="mt-6 rounded-[var(--oc-radius)] p-5 text-sm leading-relaxed whitespace-pre-line"
              style={{ background: 'var(--oc-bg-soft)' }}
            >
              {giving.bankDetails}
            </div>
          ) : null}
          {giving.mode === 'CUSTOM' && giving.customText ? (
            <div className="mt-6">
              <Markdown>{giving.customText}</Markdown>
            </div>
          ) : null}
          {giving.mode === 'EXTERNAL' && safeExternalUrl(giving.externalUrl) ? (
            <a
              href={safeExternalUrl(giving.externalUrl) as string}
              target="_blank"
              rel="noopener noreferrer"
              className="ocs-btn ocs-btn-primary mt-6"
            >
              {giving.isDemo ? 'Open demonstration giving page' : 'Give securely online'}{' '}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          ) : null}
          {giving.mode === 'EXTERNAL' && !safeExternalUrl(giving.externalUrl) && !giving.isDemo ? (
            <p className="mt-4 text-sm opacity-60">
              Online giving is not configured yet — please contact the church office
              for giving options.
            </p>
          ) : null}
          {!giving.isEnabled ? (
            <p className="mt-4 text-sm opacity-60">Online giving is currently disabled.</p>
          ) : null}
          {giving.provider === 'PAYSTACK' ? (
            <p className="mt-3 text-xs opacity-50">
              Payments processed securely by Paystack{giving.isDemo ? ' (demonstration only — no real payments)' : ''}.
            </p>
          ) : null}
          {giving.provider === 'STRIPE' ? (
            <p className="mt-3 text-xs opacity-50">Payments processed securely by Stripe.</p>
          ) : null}
        </div>
        {section.showCategories && giving.categories.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-50 mb-4">
              Ways to give
            </p>
            <ul className="space-y-3">
              {giving.categories.map((c) => (
                <li key={c.id} className="ocs-card p-4 flex items-start gap-3">
                  <span
                    className="mt-1 size-2.5 rounded-full shrink-0"
                    style={{ background: 'var(--oc-secondary)' }}
                    aria-hidden
                  />
                  <div>
                    <p className="font-medium">{c.name}</p>
                    {c.description ? <p className="text-sm opacity-65 mt-0.5">{c.description}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SectionShell>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--oc-radius)] border border-dashed px-6 py-8 text-center opacity-60 text-sm" style={{ borderColor: 'var(--oc-border)' }}>
      <CalendarDays className="size-5 mx-auto mb-2 opacity-60" aria-hidden />
      {children}
    </p>
  )
}
