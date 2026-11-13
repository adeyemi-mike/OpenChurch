'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import type { SiteRenderContext, NavItem } from '@/components/site/context'
import { siteHref } from '@/components/site/context'

export function SiteHeader({ ctx }: { ctx: SiteRenderContext }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const items = ctx.nav.header.length
    ? ctx.nav.header
    : [{ label: 'Home', href: '/' }, { label: 'Contact', href: '/contact' } satisfies NavItem]

  const centered = ctx.theme.tokens.navStyle === 'centered'

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-shadow ${scrolled ? 'shadow-sm' : ''}`}
      style={{ background: 'var(--oc-bg)', borderColor: 'var(--oc-border)' }}
    >
      <div className="ocs-container">
        <div
          className={`flex items-center justify-between gap-4 ${centered ? 'flex-col py-4 md:flex-row md:py-3' : 'py-3'}`}
        >
          {/* Logo */}
          <Link
            href={`/church/${ctx.church.slug}`}
            className="flex items-center gap-2.5 min-w-0 group"
            aria-label={`${ctx.church.name} — home`}
          >
            {ctx.settings.logoUrl ? (
               
              <img
                src={ctx.settings.logoUrl}
                alt={`${ctx.church.name} logo`}
                className="size-10 rounded-lg object-contain shrink-0"
              />
            ) : (
              <span
                className="grid place-items-center size-10 rounded-lg font-semibold text-lg shrink-0"
                style={{ background: 'var(--oc-primary)', color: 'var(--oc-primary-fg)' }}
                aria-hidden
              >
                {ctx.church.name.slice(0, 1)}
              </span>
            )}
            <span className="ocs-heading text-lg font-semibold truncate group-hover:opacity-80 transition-opacity">
              {ctx.church.name}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav
            className={`${centered ? 'hidden md:flex items-center gap-1' : 'hidden lg:flex items-center gap-1'}`}
            aria-label="Primary"
          >
            {items.map((item) => (
              <Link
                key={`${item.label}-${item.href}`}
                href={siteHref(ctx, item.href)}
                className="rounded-md px-3 py-2 text-[0.95rem] font-medium hover:opacity-100 opacity-80 transition-opacity hover:bg-black/[0.04]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={siteHref(ctx, items.find((i) => i.href === '/contact') ? '/contact' : items[items.length - 1]?.href ?? '/')}
              className="ocs-btn ocs-btn-primary ml-2 !min-h-0 !py-2 !px-4 text-sm"
            >
              Get in touch
            </Link>
          </nav>

          {/* Mobile toggle */}
          <button
            type="button"
            className="lg:hidden rounded-lg border p-2"
            style={{ borderColor: 'var(--oc-border)' }}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open ? (
        <nav
          id="mobile-nav"
          className="lg:hidden border-t px-4 py-3 space-y-0.5"
          style={{ borderColor: 'var(--oc-border)', background: 'var(--oc-bg)' }}
          aria-label="Primary, mobile"
        >
          {items.map((item) => (
            <Link
              key={`m-${item.label}-${item.href}`}
              href={siteHref(ctx, item.href)}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 font-medium hover:bg-black/[0.04]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  )
}
