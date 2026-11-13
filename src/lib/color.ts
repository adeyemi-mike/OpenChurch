/**
 * Colour utilities for church branding.
 *
 * Churches choose their own primary/secondary colours. Because arbitrary
 * colours can produce unreadable combinations, every place the public site
 * renders text on a brand colour uses `contrastText()` to pick black or
 * white automatically (WCAG 2.2 AA — 4.5:1 for body text).
 */

export type Rgb = { r: number; g: number; b: number }

export function hexToRgb(hex: string): Rgb | null {
  const clean = hex.trim().replace(/^#/, '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

/** Returns the readable text colour (#000 or #fff) for a background. */
export function contrastText(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#ffffff'
  return contrastRatio(rgb, { r: 0, g: 0, b: 0 }) >=
    contrastRatio(rgb, { r: 255, g: 255, b: 255 })
    ? '#000000'
    : '#ffffff'
}

/** True when two colours meet WCAG AA for normal text. */
export function meetsAA(fgHex: string, bgHex: string): boolean {
  const fg = hexToRgb(fgHex)
  const bg = hexToRgb(bgHex)
  if (!fg || !bg) return false
  return contrastRatio(fg, bg) >= 4.5
}

/** Mix a colour toward white/black by amount (0..1). */
export function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const target = amount >= 0 ? 255 : 0
  const abs = Math.abs(amount)
  const mix = (c: number) => Math.round(c + (target - c) * abs)
  return (
    '#' +
    [mix(rgb.r), mix(rgb.g), mix(rgb.b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  )
}

export const BRAND_PRESETS: { name: string; primary: string; secondary: string }[] = [
  { name: 'Forest & Amber', primary: '#0F5C4E', secondary: '#B45309' },
  { name: 'Deep Plum & Gold', primary: '#5B2A62', secondary: '#A16207' },
  { name: 'Cathedral Burgundy', primary: '#7A1F2B', secondary: '#C29A3B' },
  { name: 'Cedar & Clay', primary: '#83351C', secondary: '#3E5C41' },
  { name: 'Midnight Teal', primary: '#0E4F5C', secondary: '#C2703D' },
  { name: 'Olive & Sand', primary: '#4A5240', secondary: '#B08D57' },
]
