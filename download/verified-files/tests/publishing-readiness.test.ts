import { describe, it, expect } from 'vitest'
import { validatePageReadiness } from '@/lib/publishing/readiness'
import { sectionHasTemplateInstructions, containsTemplateInstruction } from '@/lib/sections/template'
import type { SectionsList } from '@/lib/sections/types'

/**
 * Publishing-readiness validation:
 *  - unresolved template instructions BLOCK publishing;
 *  - missing alt text / CTA destination are WARNINGS (non-blocking);
 *  - clean content and empty dynamic sections (events/sermons) pass.
 */

const base = { id: 's1', enabled: true, title: 'Title', subtitle: '', background: 'plain' as const }

describe('validatePageReadiness', () => {
  it('BLOCKS a text-image section carrying the starter template text', () => {
    const sections = [
      { ...base, type: 'text-image' as const, body: 'Share a short, warm introduction to your church here — who you are, what you value, and what someone can expect on a Sunday.', imageUrl: '', imageAlt: '', imageSide: 'right' as const },
    ]
    const r = validatePageReadiness(sections as SectionsList)
    expect(r.ready).toBe(false)
    expect(r.blocking).toHaveLength(1)
    expect(r.blocking[0].sectionType).toBe('text-image')
  })

  it('BLOCKS a richtext section carrying the story template text', () => {
    const sections = [
      { ...base, type: 'richtext' as const, body: 'Write the story of your church — how it began, what God has done.' },
    ]
    const r = validatePageReadiness(sections as SectionsList)
    expect(r.ready).toBe(false)
    expect(r.blocking).toHaveLength(1)
  })

  it('does NOT block real church content', () => {
    const sections = [
      { ...base, type: 'text-image' as const, body: 'We are a family church in Lagos.', imageUrl: '', imageAlt: '', imageSide: 'right' as const },
    ]
    const r = validatePageReadiness(sections as SectionsList)
    expect(r.ready).toBe(true)
    expect(r.blocking).toHaveLength(0)
  })

  it('does NOT block empty dynamic sections (they have public empty states)', () => {
    const sections = [
      { ...base, type: 'events' as const, maxItems: 3, showPast: false, cta: { label: '', href: '' } },
      { ...base, type: 'sermons' as const, maxItems: 3, cta: { label: '', href: '' } },
    ]
    const r = validatePageReadiness(sections as SectionsList)
    expect(r.ready).toBe(true)
  })

  it('WARNINGS (not blocking) for an image without alt text', () => {
    const sections = [
      { ...base, type: 'text-image' as const, body: 'Real content.', imageUrl: '/media/x', imageAlt: '', imageSide: 'right' as const },
    ]
    const r = validatePageReadiness(sections as SectionsList)
    expect(r.ready).toBe(true)
    expect(r.warnings.some((w) => w.message.includes('alternative text'))).toBe(true)
  })

  it('WARNINGS for a CTA button with a label but no destination', () => {
    const sections = [
      { ...base, type: 'cta' as const, body: 'Come along', button: { label: 'Contact us', href: '' }, style: 'solid' as const },
    ]
    const r = validatePageReadiness(sections as SectionsList)
    expect(r.ready).toBe(true)
    expect(r.warnings.some((w) => w.message.includes('no destination'))).toBe(true)
  })

  it('ignores disabled sections entirely', () => {
    const sections = [
      { ...base, enabled: false, type: 'richtext' as const, body: 'Share a short, warm introduction to your church here — placeholder.' },
    ]
    const r = validatePageReadiness(sections as SectionsList)
    expect(r.ready).toBe(true)
    expect(r.blocking).toHaveLength(0)
  })
})

describe('sectionHasTemplateInstructions (renderer rule — must match readiness)', () => {
  it('flags the same sections the readiness check blocks', () => {
    const flagged = [
      { ...base, type: 'text-image' as const, body: 'Share a short, warm introduction to your church here — etc', imageUrl: '', imageAlt: '', imageSide: 'right' as const },
      { ...base, type: 'richtext' as const, body: 'Write the story of your church — etc' },
    ]
    for (const s of flagged) expect(sectionHasTemplateInstructions(s as never)).toBe(true)
  })

  it('passes real content through', () => {
    const clean = [
      { ...base, type: 'text-image' as const, body: 'Our church family.', imageUrl: '', imageAlt: '', imageSide: 'right' as const },
      { ...base, type: 'cta' as const, body: 'Visit us', button: { label: 'Plan a visit', href: '/contact' }, style: 'solid' as const },
    ]
    for (const s of clean) expect(sectionHasTemplateInstructions(s as never)).toBe(false)
  })

  it('containsTemplateInstruction handles null/empty', () => {
    expect(containsTemplateInstruction(null)).toBe(false)
    expect(containsTemplateInstruction('')).toBe(false)
  })
})
