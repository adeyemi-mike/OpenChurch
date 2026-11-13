import type { SectionInstance, SectionsList, SectionPageData } from '@/lib/sections/types'
import type { SiteRenderContext } from '@/components/site/context'
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
  if (visible.length === 0) {
    if (hasChildren) return null
    return (
      <div className="ocs-container py-24 text-center opacity-60">
        <p>This page has no content yet.</p>
      </div>
    )
  }
  return (
    <>
      {visible.map((section) => (
        <SectionRenderer key={section.id} section={section} ctx={ctx} />
      ))}
    </>
  )
}

export type { SectionPageData }
