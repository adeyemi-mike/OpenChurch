import { describe, it, expect } from 'vitest'
import { validateSections, sectionsListSchema } from '@/lib/sections/types'
import { createSection, SECTION_REGISTRY, defaultHomepageSections, starterPages } from '@/lib/sections/registry'
import { randomUUID } from 'crypto'

describe('section registry', () => {
  it('covers all 15 section types with metadata, defaults and fields', () => {
    expect(Object.keys(SECTION_REGISTRY)).toHaveLength(15)
    for (const meta of Object.values(SECTION_REGISTRY)) {
      expect(meta.name.length).toBeGreaterThan(0)
      expect(meta.fields().length).toBeGreaterThan(0)
      expect(meta.defaults()).toBeDefined()
    }
  })

  it('createSection produces schema-valid sections for every type', () => {
    for (const meta of Object.values(SECTION_REGISTRY)) {
      const section = createSection(meta.type)
      expect(section.type).toBe(meta.type)
      expect(section.id).toBeTruthy()
      const result = validateSections([section])
      expect(result.ok, `${meta.type} should validate`).toBe(true)
    }
  })

  it('starter templates validate', () => {
    for (const page of starterPages('Test Church')) {
      const result = validateSections(page.sections)
      expect(result.ok).toBe(true)
      expect(page.sections.length).toBeGreaterThan(0)
    }
    expect(defaultHomepageSections('Grace').length).toBeGreaterThanOrEqual(7)
  })
})

describe('validateSections', () => {
  it('rejects non-array payloads', () => {
    expect(validateSections({})).toEqual({ ok: false, error: expect.any(String) })
    expect(validateSections('nope')).toEqual({ ok: false, error: expect.any(String) })
  })

  it('rejects unknown section types', () => {
    const result = validateSections([{ id: randomUUID(), type: 'hologram', enabled: true }])
    expect(result.ok).toBe(false)
  })

  it('rejects a bad section among good ones (all-or-nothing)', () => {
    const good = createSection('cta')
    const bad = { ...createSection('events'), maxItems: 999 }
    const result = validateSections([good, bad])
    expect(result.ok).toBe(false)
  })

  it('accepts a fully-formed homepage', () => {
    const result = validateSections(defaultHomepageSections('Grace'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.sections.every((s) => s.enabled === true)).toBe(true)
    }
  })

  it('caps sections at 40', () => {
    const many = Array.from({ length: 41 }, () => createSection('richtext'))
    expect(sectionsListSchema.safeParse(many).success).toBe(false)
  })
})

describe('section config invariants', () => {
  it('hero CTA defaults are safe strings', () => {
    const hero = createSection('hero')
    expect(hero.type === 'hero' && hero.primaryCta.label === 'Plan your visit').toBe(true)
  })
  it('events maxItems stays within 1..9', () => {
    const events = createSection('events')
    if (events.type === 'events') {
      expect(events.maxItems).toBeGreaterThanOrEqual(1)
      expect(events.maxItems).toBeLessThanOrEqual(9)
    }
  })
})
