import 'server-only'
import type { SectionsList } from '@/lib/sections/types'
import { containsTemplateInstruction } from '@/lib/sections/template'

/**
 * Publishing-readiness validation.
 *
 * Publishes must not leak internal editor instructions to the public site
 * (e.g. "Share a short, warm introduction to your church here…"). This
 * service inspects a page's sections and separates:
 *
 *   BLOCKING — materially incomplete or unsafe to publish:
 *     unresolved template-instruction text in visible content fields.
 *     Publish is rejected with the issue list; the church replaces the
 *     text (or removes the section) and retries.
 *
 *   WARNINGS — publishable, but worth reviewing:
 *     images without alt text, CTA buttons without a destination, video
 *     sections without a URL.
 *
 * It NEVER rewrites church content and never blocks merely because optional
 * content is absent (empty events/sermons sections have proper public empty
 * states and are fine to publish).
 */

export type ReadinessIssue = {
  sectionId: string
  sectionType: string
  /** Short human-readable instruction shown in the dashboard. */
  message: string
}

export type ReadinessReport = {
  blocking: ReadinessIssue[]
  warnings: ReadinessIssue[]
  ready: boolean
}

export function validatePageReadiness(sections: SectionsList): ReadinessReport {
  const blocking: ReadinessIssue[] = []
  const warnings: ReadinessIssue[] = []

  for (const section of sections) {
    if (!section.enabled) continue

    // --- Blocking: unresolved editor instructions -------------------------
    // Uses the same rule as the public renderer (lib/sections/template.ts):
    // one shared definition of "this section is not visitor content".
    const fields: { label: string; value: string }[] = (() => {
      switch (section.type) {
        case 'text-image':
        case 'richtext':
          return [{ label: 'body', value: section.body }]
        case 'hero':
          return [
            { label: 'heading', value: section.heading },
            { label: 'subheading', value: section.subheading },
          ]
        case 'cta':
          return [
            { label: 'title', value: section.title },
            { label: 'body', value: section.body },
          ]
        default:
          return [{ label: 'title', value: section.title }]
      }
    })()
    for (const field of fields) {
      if (containsTemplateInstruction(field.value)) {
        blocking.push({
          sectionId: section.id,
          sectionType: section.type,
          message: `The "${section.type}" section still contains template instructions ("${field.value.slice(0, 60)}…") — write your own text or remove the section.`,
        })
      }
    }

    // --- Warnings ----------------------------------------------------------
    if ('imageUrl' in section && section.imageUrl && !('imageAlt' in section && section.imageAlt)) {
      warnings.push({
        sectionId: section.id,
        sectionType: section.type,
        message: `An image in the "${section.type}" section has no alternative text — describe it for screen readers.`,
      })
    }
    if (section.type === 'gallery') {
      for (const image of section.images) {
        if (!image.alt) {
          warnings.push({
            sectionId: section.id,
            sectionType: section.type,
            message: `A gallery image has no alternative text — describe it for screen readers.`,
          })
          break
        }
      }
    }
    if (section.type === 'cta' && section.button && section.button.label && !section.button.href) {
      warnings.push({
        sectionId: section.id,
        sectionType: section.type,
        message: 'A call-to-action button has a label but no destination link.',
      })
    }
    if (section.type === 'video' && !section.videoUrl) {
      warnings.push({
        sectionId: section.id,
        sectionType: section.type,
        message: 'A video section has no video URL — it will be hidden on the public site.',
      })
    }
  }

  return { blocking, warnings, ready: blocking.length === 0 }
}
