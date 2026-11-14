import type { SectionInstance, SectionsList, SectionPageData } from '@/lib/sections/types'
import type { SiteRenderContext } from '@/components/site/context'
import { sectionHasTemplateInstructions } from '@/lib/sections/template'
import {
  HeroRenderer,
  TextImageRenderer,
  GalleryRenderer,
  VideoRenderer,
  TestimonialsRenderer,
  CtaRenderer,
  FaqRenderer,
  RichTextRenderer,
} from '@/components/public/sections/content-sections'
import {
  ServicesRenderer,
  EventsRenderer,
  SermonsRenderer,
  MinistriesRenderer,
  LeadershipRenderer,
  GivingRenderer,
} from '@/components/public/sections/dynamic-sections'
import { ContactRenderer } from '@/components/public/sections/contact-section'

/**
 * Renders any section. Used by the live public website AND the builder
 * preview — one code path, so preview always matches production.
 */
export function SectionRenderer({
  section,
  ctx,
}: {
  section: SectionInstance
  ctx: SiteRenderContext
}) {
  switch (section.type) {
    case 'hero':
      return <HeroRenderer section={section} ctx={ctx} />
    case 'text-image':
      return <TextImageRenderer section={section} ctx={ctx} />
    case 'gallery':
      return <GalleryRenderer section={section} ctx={ctx} />
    case 'services':
      return <ServicesRenderer section={section} ctx={ctx} />
    case 'events':
      return <EventsRenderer section={section} ctx={ctx} />
    case 'sermons':
      return <SermonsRenderer section={section} ctx={ctx} />
    case 'ministries':
      return <MinistriesRenderer section={section} ctx={ctx} />
    case 'leadership':
      return <LeadershipRenderer section={section} ctx={ctx} />
    case 'video':
      return <VideoRenderer section={section} ctx={ctx} />
    case 'testimonials':
      return <TestimonialsRenderer section={section} ctx={ctx} />
    case 'cta':
      return <CtaRenderer section={section} ctx={ctx} />
    case 'contact':
      return <ContactRenderer section={section} ctx={ctx} />
    case 'giving':
      return <GivingRenderer section={section} ctx={ctx} />
    case 'faq':
      return <FaqRenderer section={section} ctx={ctx} />
    case 'richtext':
      return <RichTextRenderer section={section} ctx={ctx} />
    default:
      return null
  }
}

export function SectionsRenderer({
  sections,
  ctx,
  hasChildren = false,
}: {
  sections: SectionsList
  ctx: SiteRenderContext
  /** True when the page renders its own content via children (e.g. sermon
   *  detail pages pass sections=[] plus a full article). The contradictory
   *  "no content yet" placeholder must not appear above real content. */
  hasChildren?: boolean
}) {
  const visible = sections.filter((s) => s.enabled)

  // Template-instruction suppression: sections still carrying starter-template
  // editor guidance ("Share a short, warm introduction…") are never shown to
  // visitors. In draft preview an explicit dashed hint replaces the section so
  // the administrator sees WHY it is missing from the public site; publishing
  // is additionally blocked by the readiness check.
  const public_ = visible.filter((s) => !sectionHasTemplateInstructions(s))
  const suppressed = ctx.preview ? visible.filter((s) => sectionHasTemplateInstructions(s)) : []

  if (public_.length === 0 && suppressed.length === 0) {
    if (hasChildren) return null
    return (
      <div className="ocs-container py-24 text-center opacity-60">
        <p>This page has no content yet.</p>
      </div>
    )
  }
  return (
    <>
      {public_.map((section) => (
        <SectionRenderer key={section.id} section={section} ctx={ctx} />
      ))}
      {suppressed.map((section) => (
        <div key={section.id} className="ocs-container py-10">
          <div
            className="rounded-[var(--oc-radius)] border border-dashed px-6 py-8 text-center text-sm opacity-70"
            style={{ borderColor: 'var(--oc-border)' }}
          >
            <p className="font-medium">“{section.title || section.type}” is hidden from the public site</p>
            <p className="mt-1" style={{ color: 'var(--oc-muted)' }}>
              Replace the template text in this section, then publish to make it visible.
            </p>
          </div>
        </div>
      ))}
    </>
  )
}

export type { SectionPageData }
