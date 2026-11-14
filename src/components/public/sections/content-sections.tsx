import Link from 'next/link'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Markdown } from '@/components/site/markdown'
import type { SiteRenderContext } from '@/components/site/context'
import { siteHref, toYouTubeEmbed } from '@/components/site/context'
import type {
  heroConfigSchema,
  textImageConfigSchema,
  galleryConfigSchema,
  videoConfigSchema,
  testimonialsConfigSchema,
  ctaConfigSchema,
  faqConfigSchema,
  richtextConfigSchema,
} from '@/lib/sections/types'
import { shade, contrastText } from '@/lib/color'
import { cn } from '@/lib/utils'
import type { z } from 'zod'

export type HeroSection = z.infer<typeof heroConfigSchema>
export type TextImageSection = z.infer<typeof textImageConfigSchema>
export type GallerySection = z.infer<typeof galleryConfigSchema>
export type VideoSection = z.infer<typeof videoConfigSchema>
export type TestimonialsSection = z.infer<typeof testimonialsConfigSchema>
export type CtaSection = z.infer<typeof ctaConfigSchema>
export type FaqSection = z.infer<typeof faqConfigSchema>
export type RichTextSection = z.infer<typeof richtextConfigSchema>

/** Shared section shell: background, container, optional heading. */
export function SectionShell({
  section,
  ctx,
  children,
  className,
  centerHeading,
  hideHeading,
}: {
  section: { title: string; subtitle: string; background: string; enabled: boolean }
  ctx: SiteRenderContext
  children: React.ReactNode
  className?: string
  centerHeading?: boolean
  hideHeading?: boolean
}) {
  if (!section.enabled) return null
  const bg = sectionBackground(section.background, ctx)
  const center = centerHeading ?? ctx.theme.tokens.navStyle === 'centered'
  return (
    <section style={bg} className={cn('ocs-section', section.background === 'dark' && 'text-white', className)}>
      <div className="ocs-container">
        {!hideHeading && (section.title || section.subtitle) ? (
          <div className={cn('max-w-2xl mb-10', center && 'mx-auto text-center')}>
            {section.title ? (
              <h2 className="ocs-heading text-3xl sm:text-4xl" style={{ lineHeight: 1.15 }}>
                {section.title}
              </h2>
            ) : null}
            {section.subtitle ? (
              <p
                className={cn(
                  'mt-3 text-lg leading-relaxed',
                  section.background === 'dark' ? 'text-white/70' : 'opacity-70'
                )}
              >
                {section.subtitle}
              </p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  )
}

export function sectionBackground(
  background: string,
  ctx: SiteRenderContext
): React.CSSProperties {
  switch (background) {
    case 'soft':
      return { background: 'var(--oc-bg-soft)' }
    case 'dark':
      return { background: shade(ctx.settings.primaryColor, -0.55) }
    case 'accent':
      return { background: ctx.settings.secondaryColor, color: contrastText(ctx.settings.secondaryColor) }
    default:
      return { background: 'var(--oc-bg)' }
  }
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export function HeroRenderer({ section, ctx }: { section: HeroSection; ctx: SiteRenderContext }) {
  const layout = ctx.theme.tokens.heroLayout
  const overlay = { light: 0.25, medium: 0.45, dark: 0.62 }[section.overlay]
  const image = section.imageUrl || ctx.settings.heroImageUrl
  const align = section.align === 'center' || layout === 'centered' ? 'center' : 'left'

  const text = (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <h1 className="ocs-heading text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">{section.heading}</h1>
      {section.subheading ? (
        <p className="mt-5 text-lg sm:text-xl text-white/85 leading-relaxed max-w-xl" style={align === 'center' ? { marginInline: 'auto' } : undefined}>
          {section.subheading}
        </p>
      ) : null}
      {section.primaryCta.label || section.secondaryCta.label ? (
        <div className={cn('mt-8 flex flex-wrap gap-3', align === 'center' && 'justify-center')}>
          {section.primaryCta.label ? (
            <Link href={siteHref(ctx, section.primaryCta.href)} className="ocs-btn ocs-btn-secondary">
              {section.primaryCta.label}
            </Link>
          ) : null}
          {section.secondaryCta.label ? (
            <Link
              href={siteHref(ctx, section.secondaryCta.href)}
              className="ocs-btn ocs-btn-outline !text-white"
            >
              {section.secondaryCta.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  return (
    <section className="relative isolate overflow-hidden" style={{ background: shade(ctx.settings.primaryColor, -0.35) }}>
      {image ? (
         
        <img
          src={image}
          alt={section.imageAlt || `${ctx.church.name}`}
          className="absolute inset-0 size-full object-cover"
          aria-hidden={Boolean(section.imageAlt) ? undefined : true}
        />
      ) : null}
      <div className="absolute inset-0" style={{ background: `rgb(8 12 10 / ${overlay})` }} aria-hidden />
      <div className="relative ocs-container py-24 sm:py-32 lg:py-40 text-white">{text}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Text & image
// ---------------------------------------------------------------------------

export function TextImageRenderer({ section, ctx }: { section: TextImageSection; ctx: SiteRenderContext }) {
  return (
    <SectionShell section={section} ctx={ctx} hideHeading>
      <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className={cn(section.imageSide === 'left' && 'md:order-2')}>
          {section.title ? (
            <h2 className="ocs-heading text-3xl sm:text-4xl mb-4" style={{ lineHeight: 1.15 }}>
              {section.title}
            </h2>
          ) : null}
          {section.subtitle ? <p className="mb-4 text-lg opacity-70">{section.subtitle}</p> : null}
          <Markdown>{section.body}</Markdown>
        </div>
        <div className={cn('relative', section.imageSide === 'left' && 'md:order-1')}>
          {section.imageUrl ? (
             
            <img
              src={section.imageUrl}
              alt={section.imageAlt || section.title || 'Church life'}
              loading="lazy"
              className="rounded-[var(--oc-radius)] w-full aspect-[4/3] object-cover"
              style={{ boxShadow: 'var(--oc-card)' }}
            />
          ) : (
            <div
              className="rounded-[var(--oc-radius)] w-full aspect-[4/3] grid place-items-center"
              style={{ background: 'var(--oc-bg-soft)' }}
              aria-hidden
            >
              <span className="text-4xl opacity-30">📷</span>
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export function GalleryRenderer({ section, ctx }: { section: GallerySection; ctx: SiteRenderContext }) {
  if (!section.images.length) return null
  return (
    <SectionShell section={section} ctx={ctx}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {section.images.map((img, i) => (
          <figure key={i} className="group">
            <div className="overflow-hidden rounded-[var(--oc-radius)]" style={{ boxShadow: 'var(--oc-card)' }}>
              { }
              <img
                src={img.url}
                alt={img.alt || 'Church gallery image'}
                loading="lazy"
                className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            {img.caption ? (
              <figcaption className="mt-2 text-sm text-center opacity-60">{img.caption}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

export function VideoRenderer({ section, ctx }: { section: VideoSection; ctx: SiteRenderContext }) {
  const embed = toYouTubeEmbed(section.videoUrl)
  return (
    <SectionShell section={section} ctx={ctx}>
      <div className="max-w-4xl mx-auto">
        <div className="overflow-hidden rounded-[var(--oc-radius)]" style={{ boxShadow: 'var(--oc-card)' }}>
          {embed ? (
            <iframe
              src={embed}
              title={section.title || 'Video'}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full aspect-video"
            />
          ) : (
            <div className="w-full aspect-video grid place-items-center" style={{ background: 'var(--oc-bg-soft)' }}>
              <p className="text-sm opacity-50 px-6 text-center">Add a YouTube URL to this section to show a video.</p>
            </div>
          )}
        </div>
        {section.caption ? <p className="mt-3 text-sm text-center opacity-60">{section.caption}</p> : null}
      </div>
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

export function TestimonialsRenderer({ section, ctx }: { section: TestimonialsSection; ctx: SiteRenderContext }) {
  if (!section.items.length) return null
  return (
    <SectionShell section={section} ctx={ctx}>
      <div className="grid gap-6 md:grid-cols-3">
        {section.items.map((item, i) => (
          <blockquote
            key={i}
            className="rounded-[var(--oc-radius)] p-6 flex flex-col"
            style={{
              background: section.background === 'dark' ? 'rgb(255 255 255 / 0.06)' : 'var(--oc-bg)',
              boxShadow: 'var(--oc-card)',
              border: section.background === 'dark' ? '1px solid rgb(255 255 255 / 0.12)' : undefined,
            }}
          >
            <p className="text-lg leading-relaxed flex-1" style={{ fontFamily: 'var(--oc-heading-font)' }}>
              “{item.quote}”
            </p>
            <footer className="mt-4 text-sm opacity-70">
              <span className="font-semibold opacity-100">{item.name}</span>
              {item.role ? ` · ${item.role}` : ''}
            </footer>
          </blockquote>
        ))}
      </div>
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Call to action
// ---------------------------------------------------------------------------

export function CtaRenderer({ section, ctx }: { section: CtaSection; ctx: SiteRenderContext }) {
  const solid = section.style === 'solid'
  return (
    <SectionShell section={section} ctx={ctx} className="!py-16" hideHeading>
      <div
        className={cn(
          'rounded-[var(--oc-radius)] px-6 py-12 sm:px-12 text-center max-w-3xl mx-auto',
          solid ? 'text-white' : 'border-2'
        )}
        style={
          solid
            ? { background: 'var(--oc-primary)', color: 'var(--oc-primary-fg)' }
            : { borderColor: 'var(--oc-primary)' }
        }
      >
        {section.title ? <h2 className="ocs-heading text-3xl">{section.title}</h2> : null}
        {section.body ? <p className="mt-3 text-lg opacity-85 leading-relaxed">{section.body}</p> : null}
        {section.button.label ? (
          <Link
            href={siteHref(ctx, section.button.href)}
            className={cn('ocs-btn mt-8', solid ? 'ocs-btn-secondary' : 'ocs-btn-primary')}
          >
            {section.button.label}
          </Link>
        ) : null}
      </div>
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export function FaqRenderer({ section, ctx }: { section: FaqSection; ctx: SiteRenderContext }) {
  if (!section.items.length) return null
  return (
    <SectionShell section={section} ctx={ctx}>
      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {section.items.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-b" style={{ borderColor: 'var(--oc-border)' }}>
              <AccordionTrigger className="text-left text-base sm:text-lg ocs-heading [&>svg]:size-5">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed opacity-80">
                <Markdown>{item.answer}</Markdown>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Rich text
// ---------------------------------------------------------------------------

export function RichTextRenderer({ section, ctx }: { section: RichTextSection; ctx: SiteRenderContext }) {
  return (
    <SectionShell section={section} ctx={ctx}>
      <div className="max-w-3xl mx-auto">
        <Markdown>{section.body}</Markdown>
      </div>
    </SectionShell>
  )
}
