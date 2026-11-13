import { describe, it, expect } from 'vitest'
import { hexToRgb, contrastRatio, contrastText, meetsAA, shade } from '@/lib/color'

/**
 * WCAG 2.2 contrast — the public site relies on these helpers to keep
 * arbitrary church colours readable.
 */

const WHITE = { r: 255, g: 255, b: 255 }
const BLACK = { r: 0, g: 0, b: 0 }

describe('contrastRatio', () => {
  it('is 21 for pure black on white', () => {
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 1)
  })
  it('is 1 for identical colours', () => {
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5)
  })
})

describe('meetsAA', () => {
  it('accepts strong pairs and rejects weak ones', () => {
    expect(meetsAA('#000000', '#ffffff')).toBe(true)
    expect(meetsAA('#0F5C4E', '#ffffff')).toBe(true) // deep green on white
    expect(meetsAA('#777777', '#ffffff')).toBe(false) // 4.48:1 < 4.5:1
    expect(meetsAA('#cccccc', '#ffffff')).toBe(false)
  })
})

describe('contrastText', () => {
  it('picks white for dark backgrounds and black for light ones', () => {
    expect(contrastText('#0F5C4E')).toBe('#ffffff')
    expect(contrastText('#7A1F2B')).toBe('#ffffff')
    expect(contrastText('#f5deb3')).toBe('#000000') // wheat
    expect(contrastText('#ffffff')).toBe('#000000')
  })
})

describe('hexToRgb + shade', () => {
  it('parses hex', () => {
    expect(hexToRgb('#0f5c4e')).toEqual({ r: 15, g: 92, b: 78 })
    expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('nonsense')).toBeNull()
  })
  it('lightens and darkens', () => {
    expect(shade('#000000', 0.5)).toBe('#808080')
    expect(shade('#ffffff', -0.5)).toBe('#808080')
  })
})
