import type { SectionInstance, SectionPageData } from '@/lib/sections/types'
import type { ThemeDef } from '@/lib/themes/registry'
import type { FontDef } from '@/lib/themes/fonts'
import { contrastText } from '@/lib/color'
import { themeCssVars } from '@/lib/themes/registry'
import { localeFor } from '@/lib/format'

/** Everything a section renderer needs — branding, theme, church data. */
export type SiteRenderContext = {
  church: {
    slug: string
    name: string
    city: string | null
    country: string | null
    address: string | null
    phone: string | null
    email: string | null
    timezone: string
    isPublished: boolean
  }
  settings: {
    themeKey: string
    primaryColor: string
    secondaryColor: string
    fontKey: string
    logoUrl: string | null
    heroImageUrl: string | null
    footerText: string | null
    copyrightLine: string | null
    socialFacebook: string | null
    socialInstagram: string | null
    socialYoutube: string | null
    socialX: string | null
    socialTiktok: string | null
    whatsappNumber: string | null
    announcementText: string | null
    announcementEnabled: boolean
  }
  theme: ThemeDef
  font: FontDef
  nav: { header: NavItem[]; footer: NavItem[] }
  data: SectionPageData
  /** Path segments inside the church site (e.g. ["sermons"] on /sermons). */
  path?: string[]
  /** Sermon archive search state (only set on the sermons archive page). */
  sermonQuery?: string
  sermonSeriesId?: string
  /** True inside the authenticated builder preview. */
  preview: boolean
  /**
   * The custom domain this page is being SERVED under (e.g. "www.gracecommunity.org"),
   * or null when serving from the platform origin. When set, church-internal
   * links stay root-relative ("/about") instead of the /church/<slug> prefix,
   * so visitors on the church's own domain see clean URLs.
   */
  servingDomain?: string | null
}

export type NavItem = { label: string; href: string }

/** Brand + theme CSS variables applied to the .ocs-site wrapper. */
export function siteStyleVars(ctx: SiteRenderContext): React.CSSProperties {
  const vars: Record<string, string> = {
    '--oc-primary': ctx.settings.primaryColor,
    '--oc-secondary': ctx.settings.secondaryColor,
    '--oc-primary-fg': contrastText(ctx.settings.primaryColor),
    '--oc-secondary-fg': contrastText(ctx.settings.secondaryColor),
    '--oc-heading-font': `var(${ctx.font.headingVar})`,
    '--oc-body-font': `var(${ctx.font.bodyVar})`,
    ...themeCssVars(ctx.theme),
  }
  return vars as React.CSSProperties
}

/** Resolve a nav href ("/about", "/contact") to the church site URL.
 *
 * Under the church's own custom domain the href stays root-relative — the
 * proxy already routes that host to this church, so "/about" is both correct
 * and clean. On the platform origin (or in preview) the /church/<slug>
 * prefix keeps the URL unambiguous. External/mailto/tel hrefs pass through. */
export function siteHref(ctx: SiteRenderContext, href: string): string {
  if (/^(https?:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return href
  }
  const clean = href.startsWith('/') ? href : `/${href}`
  if (ctx.servingDomain) {
    return clean
  }
  return `/church/${ctx.church.slug}${clean === '/' ? '' : clean}`
}

/** Convert a YouTube URL to its embed form; returns null for non-YouTube. */
export function toYouTubeEmbed(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`
    }
    if (u.hostname.endsWith('youtube.com') || u.hostname.endsWith('youtube-nocookie.com')) {
      if (u.pathname.startsWith('/embed/')) return `https://www.youtube-nocookie.com/embed/${u.pathname.split('/')[2]}`
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`
    }
    return null
  } catch {
    return null
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Formatting options shared by the public event/sermon date helpers.
 *  Dates are always rendered in the CHURCH's timezone and locale so the
 *  displayed weekday always matches the intended local calendar date —
 *  never the visitor's own timezone. */
export type ChurchDateOptions = {
  timezone?: string
  country?: string | null
}

function churchLocale(country: string | null | undefined): string | undefined {
  if (!country) return undefined
  const locale = localeFor(country)
  return locale === 'en' ? undefined : locale
}

/** Date badge pieces for event cards (rendered in the church's timezone). */
export function dateParts(iso: string, opts?: ChurchDateOptions) {
  const d = new Date(iso)
  if (opts?.timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: opts.timezone,
      }).formatToParts(d)
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
      return { day: get('day'), month: get('month'), year: get('year') }
    } catch {
      /* invalid timezone — fall through to local rendering */
    }
  }
  return { day: String(d.getDate()), month: MONTHS[d.getMonth()], year: d.getFullYear() }
}

/**
 * Full event date, e.g. "Sunday, 14 November 2027" — the year is ALWAYS
 * shown (a weekday + month/day label alone is ambiguous across years),
 * rendered in the church's timezone and locale. An invalid stored timezone
 * degrades to visitor-locale rendering instead of crashing the page.
 */
export function formatEventDate(iso: string, opts?: ChurchDateOptions): string {
  const d = new Date(iso)
  const locale = churchLocale(opts?.country) ?? undefined
  if (opts?.timezone) {
    try {
      return d.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: opts.timezone,
      })
    } catch {
      /* invalid timezone — fall through to visitor-locale rendering */
    }
  }
  return d.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatEventTime(iso: string, opts?: ChurchDateOptions): string {
  const d = new Date(iso)
  const locale = churchLocale(opts?.country) ?? undefined
  if (opts?.timezone) {
    try {
      return d.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: opts.timezone,
      })
    } catch {
      /* invalid timezone — fall through */
    }
  }
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

export type { SectionInstance }
