import { Megaphone } from 'lucide-react'
import { sectionsListSchema, type SectionsList } from '@/lib/sections/types'
import { getTheme } from '@/lib/themes/registry'
import { getFont } from '@/lib/themes/fonts'
import { fromJson } from '@/lib/serialization'
import { shade } from '@/lib/color'
import { SiteRenderContext, siteStyleVars } from '@/components/site/context'
import { SiteHeader } from '@/components/site/header'
import { SiteFooter } from '@/components/site/footer'
import { SectionsRenderer } from '@/components/public/sections/section-renderer'

type RenderInput = {
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
  nav: { header: { label: string; href: string }[]; footer: { label: string; href: string }[] }
  data: SiteRenderContext['data']
  path?: string[]
  sermonQuery?: string
  sermonSeriesId?: string
  preview: boolean
  /** Custom domain the page is served under (null on the platform origin). */
  servingDomain?: string | null
}

/**
 * The public church website — one renderer for every church, driven entirely
 * by each church's branding, theme, navigation and page sections.
 */
export function ChurchSite({
  church,
  settings,
  nav,
  data,
  preview,
  servingDomain,
  sections,
  path,
  sermonQuery,
  sermonSeriesId,
  children,
  pageHeading,
}: RenderInput & {
  sections: SectionsList
  children?: React.ReactNode
  /** Accessible page heading (h1) for section-built pages without a hero. */
  pageHeading?: string
}) {
  const theme = getTheme(settings.themeKey)
  const font = getFont(settings.fontKey)

  const ctx: SiteRenderContext = {
    church,
    settings,
    theme,
    font,
    nav,
    data,
    path,
    sermonQuery,
    sermonSeriesId,
    preview,
    servingDomain: servingDomain ?? null,
  }

  return (
    <div
      className="ocs-site flex min-h-screen flex-col"
      style={
        {
          ...siteStyleVars(ctx),
          // Soft background derived from brand colour. Inlined here rather than
          // via an inline <style> element: React 19 treats <style> as hoistable
          // and removes it from its rendered position during hydration, which
          // shifts every following sibling and fails hydration on church pages.
          '--oc-bg-soft': shade(settings.primaryColor, 0.86),
        } as React.CSSProperties
      }
      data-theme={theme.key}
    >

      <a href="#main-content" className="ocs-skip-link">
        Skip to main content
      </a>

      {settings.announcementEnabled && settings.announcementText ? (
        <div
          className="text-center text-sm font-medium px-4 py-2.5"
          style={{ background: settings.secondaryColor, color: 'var(--oc-secondary-fg)' }}
        >
          <span className="inline-flex items-center gap-2 justify-center">
            <Megaphone className="size-4 shrink-0" aria-hidden />
            {settings.announcementText}
          </span>
        </div>
      ) : null}

      <SiteHeader ctx={ctx} />

      {preview ? (
        <div className="text-center text-xs font-semibold uppercase tracking-wider py-2 border-b" style={{ background: 'var(--oc-bg-soft)', borderColor: 'var(--oc-border)', color: 'var(--oc-secondary)' }}>
          Draft preview — visitors see the published version
        </div>
      ) : null}

      <main id="main-content" className="flex-1">
        {pageHeading ? <h1 className="sr-only">{pageHeading}</h1> : null}
        <SectionsRenderer sections={sections} ctx={ctx} hasChildren={Boolean(children)} />
        {children}
      </main>

      <SiteFooter ctx={ctx} />
    </div>
  )
}

export function parseSections(raw: string | null): SectionsList {
  const parsed: unknown = fromJson<unknown>(raw, [])
  // Normalise through the Zod schema: fills any missing field defaults
  // (e.g. section CTAs) so older stored snapshots stay renderable.
  const result = sectionsListSchema.safeParse(parsed)
  if (result.success) return result.data
  return fromJson<SectionsList>(raw, [])
}
