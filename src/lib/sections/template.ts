import type { SectionInstance } from './types'
import { TEMPLATE_PLACEHOLDERS } from './registry'

/**
 * Template-instruction detection (pure, client-safe).
 *
 * Shared by the publishing-readiness service (server) and the public
 * section renderer so both use exactly the same rule: a section whose
 * visible free-text still carries a starter-template editor instruction
 * ("Share a short, warm introduction to your church here…") is not
 * visitor-facing content.
 */

/** Does this text contain a known template/editor instruction? */
export function containsTemplateInstruction(text: string | null | undefined): boolean {
  if (!text) return false
  return TEMPLATE_PLACEHOLDERS.some((p) => text.includes(p))
}

/** Visible free-text fields of a section that could carry instructions. */
function templateFields(section: SectionInstance): string[] {
  switch (section.type) {
    case 'text-image':
      return [section.body]
    case 'richtext':
      return [section.body]
    case 'hero':
      return [section.heading, section.subheading]
    case 'cta':
      return [section.title, section.body]
    default:
      return [section.title, section.subtitle]
  }
}

/** Does this section still contain unresolved template instructions? */
export function sectionHasTemplateInstructions(section: SectionInstance): boolean {
  return templateFields(section).some((value) => containsTemplateInstruction(value))
}
