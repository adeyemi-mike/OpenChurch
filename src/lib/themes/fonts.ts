/**
 * Typography registry for public church websites.
 *
 * Fonts are loaded once in the root layout via next/font and exposed as CSS
 * variables. Churches pick a "typography" (font pairing) in the appearance
 * settings; themes provide a default pairing that matches their character.
 * A community theme can introduce new pairings by extending this registry.
 */

export type FontDef = {
  key: string
  label: string
  description: string
  headingVar: string // CSS variable with the heading family
  bodyVar: string // CSS variable with the body family
}

export const FONTS: FontDef[] = [
  {
    key: 'sans',
    label: 'Clean Sans',
    description: 'Geist Sans throughout — modern, highly legible.',
    headingVar: '--font-geist-sans',
    bodyVar: '--font-geist-sans',
  },
  {
    key: 'serif',
    label: 'Classic Serif',
    description: 'Lora for headings and body — timeless, literary.',
    headingVar: '--font-lora',
    bodyVar: '--font-lora',
  },
  {
    key: 'display',
    label: 'Display Serif',
    description: 'Fraunces display headings with Geist body text.',
    headingVar: '--font-fraunces',
    bodyVar: '--font-geist-sans',
  },
  {
    key: 'mixed',
    label: 'Serif & Sans',
    description: 'Lora headings with a clean sans body — editorial feel.',
    headingVar: '--font-lora',
    bodyVar: '--font-geist-sans',
  },
]

export const DEFAULT_FONT_KEY = 'sans'

export function getFont(key: string | null | undefined): FontDef {
  return FONTS.find((f) => f.key === key) ?? FONTS[0]
}
