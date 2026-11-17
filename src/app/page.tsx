import Link from 'next/link'
import type { Metadata } from 'next'
import {
  LayoutTemplate,
  Palette,
  Building2,
  ShieldCheck,
  Images,
  BookOpen,
  CalendarDays,
  HandCoins,
  Globe2,
  Accessibility,
  Github,
  ArrowRight,
  Sparkles,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HeroMockup } from '@/components/platform/hero-mockup'
import { ProfessionalServices } from '@/components/platform/professional-services'
import { OpenChurchMark } from '@/components/platform/brand'
import { THEMES } from '@/lib/themes/registry'
import { getSessionUser } from '@/lib/auth/session'
import { isDemoModeEnabled, DEMO_PASSWORD_HINT } from '@/lib/demo-mode'
import { db } from '@/lib/db'

// Public repository link. The official OpenChurch repository is the default;
// self-hosters and forks override it with NEXT_PUBLIC_REPO_URL.
const REPO_URL =
  process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/adeyemi-mike/OpenChurch'
const INSTALLATION_URL = `${REPO_URL}/blob/main/docs/INSTALLATION.md`

export const dynamic = 'force-dynamic'

/**
 * Platform homepage metadata — the platform's own brand identity, distinct
 * from any church site. `metadataBase` is request-aware (root layout), so
 * canonical/OG/Twitter URLs always resolve to the configured public origin
 * and never to localhost in production.
 */
export const metadata: Metadata = {
  title: {
    absolute: 'OpenChurch — Every Church Deserves a Digital Home',
  },
  description:
    'Complete, free and open-source church website software. Build, customise and deploy your own church website with full control of your code and infrastructure.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'OpenChurch',
    title: 'OpenChurch — Every Church Deserves a Digital Home',
    description:
      'Complete, free and open-source church website software. Build, customise and deploy your own church website with full control of your code and infrastructure.',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'OpenChurch — website builder for churches',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenChurch — Every Church Deserves a Digital Home',
    description:
      'Complete, free and open-source church website software. Build, customise and deploy your own church website with full control of your code and infrastructure.',
    images: ['/og-default.png'],
  },
}

const FEATURES = [
  {
    icon: LayoutTemplate,
    title: 'No-code page builder',
    text: 'Compose pages from sections — hero, events, sermons, galleries, FAQs — with drag-free reordering, live preview and one-click publish.',
  },
  {
    icon: Palette,
    title: 'Themes & your branding',
    text: 'Three professional themes to start from, then make it yours: colours, typography, logo and imagery. No two churches look alike.',
  },
  {
    icon: Building2,
    title: 'Multi-church by design',
    text: 'Built for one church or a growing network. Strict tenant isolation keeps every church’s content, media and users separate.',
  },
  {
    icon: ShieldCheck,
    title: 'Roles & permissions',
    text: 'Owners, administrators, editors and authors with server-enforced permissions and a full audit trail of administrative actions.',
  },
  {
    icon: Images,
    title: 'Media library',
    text: 'Upload images and documents with alt text, folders and validation. Reuse anything anywhere with the built-in media picker.',
  },
  {
    icon: BookOpen,
    title: 'Sermons & series',
    text: 'A sermon archive with speakers, scripture references, series and YouTube embeds — searchable and always in sync.',
  },
  {
    icon: CalendarDays,
    title: 'Events & services',
    text: 'Upcoming and past events, registration links, weekly service schedules, multiple locations and time zones.',
  },
  {
    icon: HandCoins,
    title: 'Giving-ready',
    text: 'Tithes, offerings, missions, building funds — configurable categories with secure external giving links or bank instructions.',
  },
  {
    icon: Globe2,
    title: 'International by default',
    text: 'Multiple currencies, time zones, date formats and address formats. No country is hardcoded — Lagos, London or Lima.',
  },
  {
    icon: Accessibility,
    title: 'Accessible & SEO-first',
    text: 'Semantic HTML, keyboard navigation, WCAG-conscious contrast, editable meta, Open Graph, sitemaps and structured data.',
  },
  {
    icon: Sparkles,
    title: 'Own your content',
    text: 'Open source under MIT. Self-host anywhere, export your content, no vendor lock-in — your website is yours.',
  },
  {
    icon: Github,
    title: 'Community-driven',
    text: 'Built in the open. Contribute themes, sections, translations and integrations — the architecture is made for it.',
  },
]

const THEME_SWATCHES: Record<string, { colors: string[]; cta: string }> = {
  modern: { colors: ['#1A1A1A', '#F5F3EF', '#0F5C4E'], cta: 'Join us Sunday' },
  traditional: { colors: ['#7A1F2B', '#B08D57', '#F8F5EF'], cta: 'Service times' },
  vibrant: { colors: ['#0B6E4F', '#D97706', '#131110'], cta: 'Plan your visit' },
}

export default async function LandingPage() {
  const user = await getSessionUser()

  /*
   * Showcase churches are real tenant records from THIS deployment's
   * database — never hardcoded names. A deployment without seeded demo
   * data (e.g. a real single-church install) shows its actual church;
   * a deployment with no published churches hides the section entirely.
   * This guarantees every marketing link resolves (no advertised 404s).
   *
   * Demonstration accounts are surfaced only while server-side demo mode
   * is enabled AND the church is flagged isDemo.
   */
  const demoMode = isDemoModeEnabled()
  const churches = await db.church.findMany({
    where: {
      isPublished: true,
      status: 'ACTIVE',
      // Never advertise demo tenants on a deployment that disabled demo mode.
      ...(demoMode ? {} : { isDemo: false }),
    },
    include: { settings: true },
    orderBy: [{ isDemo: 'desc' }, { publishedAt: 'asc' }],
    take: 2,
  })
  const showcase = await Promise.all(
    churches.map(async (c) => {
      const [sermons, events, ministries] = await Promise.all([
        db.sermon.count({ where: { churchId: c.id, status: 'PUBLISHED' } }),
        db.event.count({ where: { churchId: c.id, status: 'PUBLISHED' } }),
        db.ministry.count({ where: { churchId: c.id, status: 'PUBLISHED' } }),
      ])
      let demoLogin: string | null = null
      if (demoMode && c.isDemo) {
        const owner = await db.churchMembership.findFirst({
          where: { churchId: c.id, role: 'OWNER', user: { isDemo: true } },
          select: { user: { select: { email: true } } },
        })
        demoLogin = owner?.user.email ?? null
      }
      const theme = THEMES.find((t) => t.key === c.settings?.themeKey)
      const location = [c.city, c.country].filter(Boolean).join(', ')
      return {
        href: `/church/${c.slug}`,
        name: c.name,
        meta: [location, theme ? `${theme.name} theme` : null].filter(Boolean).join(' · '),
        colors: [c.settings?.primaryColor || '#0F5C4E', c.settings?.secondaryColor || '#B45309'] as [string, string],
        points: [
          sermons > 0 ? `${sermons} published sermon${sermons === 1 ? '' : 's'}` : 'Section-driven pages',
          events > 0 ? `${events} upcoming event${events === 1 ? '' : 's'}` : 'Events & service schedule',
          ministries > 0 ? `${ministries} ministries` : 'Custom branding & themes',
        ],
        login: demoLogin,
      }
    })
  )
  const hasShowcase = showcase.length > 0
  const demoShowcase = demoMode && showcase.some((s) => s.login)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="OpenChurch home">
            <OpenChurchMark className="size-9 text-primary" />
            <span className="text-lg">
              <span className="font-bold text-primary">Open</span>Church
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground" aria-label="Main">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#themes" className="hover:text-foreground transition-colors">Themes</a>
            {hasShowcase && (
              <a href="#demo" className="hover:text-foreground transition-colors">Live site{showcase.length > 1 ? 's' : ''}</a>
            )}
            <a href="#opensource" className="hover:text-foreground transition-colors">Open source</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild size="sm">
                <Link href="/console">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                {/* Secondary action only from sm up — keeps 320–390px headers one-line */}
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 sm:pt-24 pb-12 text-center">
            <p className="inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-secondary-foreground/70" aria-hidden />
              Free & open source — MIT licensed
            </p>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-balance">
              Every Church Deserves a{' '}
              <span className="text-primary">Digital Home</span>
            </h1>
            <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground text-pretty">
              OpenChurch is an open-source platform that gives any church — in any country,
              denomination or language — a beautiful, accessible website it can build and
              manage without a developer.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" className="px-7">
                <Link href="/register">
                  Create your church website <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={hasShowcase ? '#demo' : '#features'}>
                  {hasShowcase ? 'See a live church site' : 'Explore the features'}
                </a>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Self-host it, or run it as a multi-church platform. No credit card, no catch.
            </p>
            <div className="mt-14 sm:mt-16">
              <HeroMockup />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t bg-muted/30 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Everything a church needs</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">
                A complete platform, not a template
              </h2>
              <p className="mt-3 text-muted-foreground">
                Pages, ministries, leadership, sermons, events, media, forms and giving —
                in one dashboard your volunteers can actually use.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="group rounded-2xl border bg-background p-6 transition-shadow hover:shadow-md">
                  <span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary">
                    <f.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Themes */}
        <section id="themes" className="py-20 sm:py-24 border-t">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Design that fits you</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">
                Three themes. Infinite customisation.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Themes are starting points, never boxes. Every church keeps full control of
                colours, typography, sections and imagery.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {THEMES.map((theme) => (
                <article key={theme.key} className="rounded-2xl border overflow-hidden bg-background group">
                  {/* Mini preview */}
                  <div className="p-6" style={{ background: THEME_SWATCHES[theme.key].colors[1] }}>
                    <div className="rounded-lg border bg-white/70 backdrop-blur p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span
                          className="h-2.5 w-16 rounded-full"
                          style={{ background: THEME_SWATCHES[theme.key].colors[0] }}
                        />
                        <div className="flex gap-1.5">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="h-1.5 w-5 rounded-full bg-foreground/15" />
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 space-y-1.5">
                        <span
                          className="block h-3 w-3/4 rounded"
                          style={{ background: THEME_SWATCHES[theme.key].colors[0] }}
                        />
                        <span className="block h-3 w-1/2 rounded bg-foreground/10" />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <span
                          className="rounded-full px-3 py-1 text-[10px] font-semibold text-white"
                          style={{ background: THEME_SWATCHES[theme.key].colors[2], borderRadius: theme.tokens.buttons === 'pill' ? 999 : theme.tokens.buttons === 'square' ? 2 : 8 }}
                        >
                          {THEME_SWATCHES[theme.key].cta}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="font-semibold">{theme.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{theme.tagline}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground/80">{theme.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t bg-muted/30 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
              From sign-up to published in an afternoon
            </h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'Create your free account',
                  text: 'Register with your email. Your account can manage one church or many.',
                },
                {
                  step: '02',
                  title: 'Guided church setup',
                  text: 'The onboarding wizard walks you through identity, colours, leadership, ministries and service times — skip anything and return later.',
                },
                {
                  step: '03',
                  title: 'Build, preview, publish',
                  text: 'Arrange sections, watch the live preview on desktop, tablet and mobile, then publish. Your site is live at your own address.',
                },
              ].map((s) => (
                <li key={s.step} className="relative rounded-2xl border bg-background p-6">
                  <span className="text-sm font-mono font-semibold text-secondary">{s.step}</span>
                  <h3 className="mt-2 font-semibold text-lg">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Live sites — real tenant records from this deployment */}
        {hasShowcase && (
        <section id="demo" className="py-20 sm:py-24 border-t">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">See it in action</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">
                {demoShowcase
                  ? showcase.length > 1 ? 'Two demo churches, live' : 'A demo church, live'
                  : showcase.length > 1 ? 'Churches live on this platform' : 'A church, live on this platform'}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {demoShowcase ? (
                  <>Every site below is generated by the same platform — different themes,
                  colours, content and countries. Sign in to their dashboards to see the admin
                  side (demo data, clearly labelled).</>
                ) : (
                  <>Real churches running on this installation — each with its own theme,
                  content, media and dashboard. The same platform can host yours.</>
                )}
              </p>
            </div>
            <div className={`mt-10 grid gap-6 ${showcase.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
              {showcase.map((d) => (
                <article key={d.href} className="rounded-2xl border overflow-hidden bg-background md:max-w-xl">
                  <div className="h-2 flex" aria-hidden>
                    <span className="flex-1" style={{ background: d.colors[0] }} />
                    <span className="flex-1" style={{ background: d.colors[1] }} />
                  </div>
                  <div className="p-6">
                    <h3 className="font-semibold text-lg">{d.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{d.meta || 'Built with OpenChurch'}</p>
                    <ul className="mt-4 space-y-2">
                      {d.points.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="size-4 mt-0.5 shrink-0 text-primary" aria-hidden />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <Button asChild size="sm">
                        <Link href={d.href}>
                          Visit the website <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      </Button>
                      {d.login && (
                        <span className="text-xs text-muted-foreground">
                          Dashboard: <code className="rounded bg-muted px-1.5 py-0.5">{d.login}</code>
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {demoShowcase && (
              <p className="mt-6 text-xs text-muted-foreground">
                Demo password for all accounts: <code className="rounded bg-muted px-1.5 py-0.5">{DEMO_PASSWORD_HINT}</code> — demo content is fictional and labelled as such.
              </p>
            )}
          </div>
        </section>
        )}

        {/* Open source */}
        <section id="opensource" className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
            <div className="md:grid md:grid-cols-2 md:gap-16 items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Open source, forever</p>
                <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">
                  Your church website should belong to your church
                </h2>
                <p className="mt-4 text-primary-foreground/80 leading-relaxed">
                  OpenChurch is licensed under MIT. Download it, self-host it on a €4 VPS or your
                  denomination’s servers, customise it, and keep your data — with no subscription
                  and no lock-in. Managed hosting is optional, never required.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/register">Start free now</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                      <Github className="size-4" aria-hidden /> View Source Code
                    </a>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="ghost"
                    className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    <a href={INSTALLATION_URL} target="_blank" rel="noopener noreferrer">
                      Read the Installation Guide
                    </a>
                  </Button>
                </div>
              </div>
              <ul className="mt-10 md:mt-0 space-y-3">
                {[
                  'MIT license — commercial use allowed',
                  'Docker deployment for self-hosters',
                  'Documented architecture for contributors',
                  'Tenant isolation with server-enforced permissions',
                  'Translation-ready interface architecture',
                  'Export your church data at any time (JSON)',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/15 px-4 py-3 text-sm">
                    <Check className="size-4 mt-0.5 shrink-0 text-amber-200" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Optional professional services by PillarsConnect Ltd — the software
            stays free and self-hostable; services are strictly optional. */}
        <ProfessionalServices />
      </main>

      {/* Footer (sticky) */}
      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 font-semibold">
            <OpenChurchMark className="size-8 text-primary" />
            <span>
              <span className="font-bold text-primary">Open</span>Church
            </span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Footer">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            {hasShowcase && <a href="#demo" className="hover:text-foreground transition-colors">Live site{showcase.length > 1 ? 's' : ''}</a>}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Source code</a>
            <a href={INSTALLATION_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Installation guide</a>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Get started</Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            <Link href="/license" className="hover:text-foreground transition-colors underline underline-offset-2">
              MIT licensed
            </Link>{' '}
            · Built for the global church
          </p>
        </div>
        {/* Compact professional assistance link — secondary placement for the
            optional PillarsConnect services (full section lives on the homepage). */}
        <div className="border-t">
          <p className="mx-auto max-w-6xl px-4 sm:px-6 py-4 text-center text-xs text-muted-foreground">
            Need help with OpenChurch setup, custom domains or a new website?{' '}
            <a
              href="#professional-services"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Get professional assistance from PillarsConnect Ltd
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  )
}
warning: in the working copy of 'src/app/page.tsx', LF will be replaced by CRLF the next time Git touches it