import Link from 'next/link'
import { Facebook, Instagram, Youtube, Twitter, Music2, MapPin, Phone, Mail } from 'lucide-react'
import type { SiteRenderContext } from '@/components/site/context'
import { siteHref } from '@/components/site/context'
import { safeExternalUrl } from '@/lib/url'

export function SiteFooter({ ctx }: { ctx: SiteRenderContext }) {
  const columns = ctx.theme.tokens.footerStyle === 'columns'
  const items = ctx.nav.footer.length ? ctx.nav.footer : ctx.nav.header
  // Every social URL is validated before rendering: a bare platform
  // homepage ("https://x.com/"), a placeholder ("example.com") or a
  // malformed value is dropped — the icon is hidden rather than shown as a
  // link that misleads visitors. Unconfigured networks stay hidden.
  const socials = [
    { href: safeExternalUrl(ctx.settings.socialFacebook), icon: Facebook, label: 'Facebook' },
    { href: safeExternalUrl(ctx.settings.socialInstagram), icon: Instagram, label: 'Instagram' },
    { href: safeExternalUrl(ctx.settings.socialYoutube), icon: Youtube, label: 'YouTube' },
    { href: safeExternalUrl(ctx.settings.socialX), icon: Twitter, label: 'X (Twitter)' },
    { href: safeExternalUrl(ctx.settings.socialTiktok), icon: Music2, label: 'TikTok' },
  ].filter((s) => s.href)

  const contact = ctx.data.contact

  return (
    <footer
      className="mt-auto"
      style={{ background: 'var(--oc-primary)', color: 'var(--oc-primary-fg)' }}
    >
      <div className="ocs-container py-12">
        {columns ? (
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <p className="ocs-heading text-xl font-semibold">{ctx.church.name}</p>
              <p className="mt-3 text-sm leading-relaxed opacity-80 max-w-md">
                {ctx.settings.footerText ?? ctx.church.name}
              </p>
              {socials.length > 0 ? (
                <div className="mt-5 flex gap-2">
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="grid place-items-center size-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <s.icon className="size-4.5" aria-hidden />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            <nav aria-label="Footer">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-60">Explore</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {items.map((item) => (
                  <li key={`f-${item.label}-${item.href}`}>
                    <Link href={siteHref(ctx, item.href)} className="opacity-85 hover:opacity-100 hover:underline underline-offset-4">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-60">Contact</p>
              <ul className="mt-4 space-y-2.5 text-sm opacity-85">
                {contact.address ? (
                  <li className="flex items-start gap-2">
                    <MapPin className="size-4 mt-0.5 shrink-0 opacity-70" aria-hidden />
                    <span>{[contact.address, contact.city].filter(Boolean).join(', ')}</span>
                  </li>
                ) : null}
                {contact.phone ? (
                  <li className="flex items-start gap-2">
                    <Phone className="size-4 mt-0.5 shrink-0 opacity-70" aria-hidden />
                    <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="hover:underline">{contact.phone}</a>
                  </li>
                ) : null}
                {contact.email ? (
                  <li className="flex items-start gap-2">
                    <Mail className="size-4 mt-0.5 shrink-0 opacity-70" aria-hidden />
                    <a href={`mailto:${contact.email}`} className="hover:underline break-all">{contact.email}</a>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <p className="ocs-heading text-xl font-semibold">{ctx.church.name}</p>
              <p className="mt-2 text-sm opacity-80 max-w-lg leading-relaxed">
                {ctx.settings.footerText ?? ctx.church.name}
              </p>
              {socials.length > 0 ? (
                <div className="mt-5 flex gap-2">
                  {socials.map((s) => (
                    <a
                      key={`s-${s.label}`}
                      href={s.href as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="grid place-items-center size-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <s.icon className="size-4.5" aria-hidden />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {items.map((item) => (
                <Link
                  key={`fs-${item.label}-${item.href}`}
                  href={siteHref(ctx, item.href)}
                  className="opacity-85 hover:opacity-100 hover:underline underline-offset-4"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <div
          className="mt-10 pt-6 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-70"
        >
          <p>{ctx.settings.copyrightLine ?? `© ${new Date().getFullYear()} ${ctx.church.name}`}</p>
          {ctx.preview ? (
            <p className="font-medium">Preview mode — unpublished draft</p>
          ) : (
            <p>
              Website by{' '}
              <Link href="/" className="underline underline-offset-2 hover:opacity-100">
                OpenChurch
              </Link>{' '}
              — open source
            </p>
          )}
        </div>
      </div>
    </footer>
  )
}
