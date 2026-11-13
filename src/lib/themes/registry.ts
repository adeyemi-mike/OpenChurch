/**
 * Theme registry.
 *
 * A theme is a set of layout & typography tokens — a *starting point*, never
 * a restriction. Churches keep full control of colours, typography, images
 * and visible sections regardless of theme (product principle #2).
 *
 * Contributing a theme: add a `ThemeDef` to THEMES below. No core code
 * changes required — the public renderer and the builder preview read this
 * registry. See docs/CONTRIBUTING (themes) in the repository README.
 */

export type ThemeKey = 'modern' | 'traditional' | 'vibrant'

export type ThemeDef = {
  key: ThemeKey
  name: string
  tagline: string
  description: string
  defaultFontKey: string
  tokens: {
    /** Max content width on large screens. */
    container: 'narrow' | 'wide' | 'full'
    /** Vertical rhythm inside sections. */
    sectionPadding: 'airy' | 'classic' | 'compact'
    headingWeight: 'normal' | 'medium' | 'bold'
    headingTracking: 'tight' | 'normal' | 'wide'
    uppercaseKicker: boolean
    radius: 'none' | 'subtle' | 'soft'
    cardStyle: 'outline' | 'shadow' | 'flat'
    navStyle: 'left' | 'centered'
    heroLayout: 'split' | 'fullbleed' | 'centered'
    heroOverlay: 'light' | 'medium' | 'dark'
    buttons: 'rounded' | 'square' | 'pill'
    footerStyle: 'simple' | 'columns'
  }
}

export const THEMES: ThemeDef[] = [
  {
    key: 'modern',
    name: 'Modern Minimal',
    tagline: 'Clean layouts, large type, generous space.',
    description:
      'Understated design that lets your message and photography breathe. Ideal for churches that want a contemporary, uncluttered presence.',
    defaultFontKey: 'sans',
    tokens: {
      container: 'narrow',
      sectionPadding: 'airy',
      headingWeight: 'medium',
      headingTracking: 'tight',
      uppercaseKicker: true,
      radius: 'subtle',
      cardStyle: 'outline',
      navStyle: 'left',
      heroLayout: 'split',
      heroOverlay: 'medium',
      buttons: 'rounded',
      footerStyle: 'simple',
    },
  },
  {
    key: 'traditional',
    name: 'Traditional Elegant',
    tagline: 'Refined typography, formal layouts.',
    description:
      'A dignified, established feel with serif typography and formal structure — well suited to liturgical and traditional congregations.',
    defaultFontKey: 'serif',
    tokens: {
      container: 'narrow',
      sectionPadding: 'classic',
      headingWeight: 'normal',
      headingTracking: 'normal',
      uppercaseKicker: false,
      radius: 'subtle',
      cardStyle: 'outline',
      navStyle: 'centered',
      heroLayout: 'centered',
      heroOverlay: 'dark',
      buttons: 'square',
      footerStyle: 'columns',
    },
  },
  {
    key: 'vibrant',
    name: 'Contemporary Vibrant',
    tagline: 'Bold visuals, strong hierarchy, big CTAs.',
    description:
      'High-energy design with large photographic sections and prominent calls to action — great for growing, contemporary ministries.',
    defaultFontKey: 'display',
    tokens: {
      container: 'wide',
      sectionPadding: 'airy',
      headingWeight: 'bold',
      headingTracking: 'tight',
      uppercaseKicker: true,
      radius: 'soft',
      cardStyle: 'shadow',
      navStyle: 'left',
      heroLayout: 'fullbleed',
      heroOverlay: 'dark',
      buttons: 'pill',
      footerStyle: 'columns',
    },
  },
]

export function getTheme(key: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.key === key) ?? THEMES[0]
}

/** CSS custom properties consumed by the public site renderer. */
export function themeCssVars(theme: ThemeDef): Record<string, string> {
  const t = theme.tokens
  return {
    '--oc-container': t.container === 'narrow' ? '72rem' : t.container === 'wide' ? '80rem' : '100%',
    '--oc-section-py':
      t.sectionPadding === 'airy' ? '5.5rem' : t.sectionPadding === 'classic' ? '4rem' : '3rem',
    '--oc-heading-weight':
      t.headingWeight === 'bold' ? '700' : t.headingWeight === 'medium' ? '600' : '500',
    '--oc-heading-tracking': t.headingTracking === 'tight' ? '-0.02em' : t.headingTracking === 'wide' ? '0.08em' : '0',
    '--oc-radius': t.radius === 'none' ? '0px' : t.radius === 'subtle' ? '6px' : '14px',
    '--oc-card':
      t.cardStyle === 'outline' ? '1px solid var(--oc-border)' : t.cardStyle === 'shadow' ? '0 10px 30px -12px rgb(0 0 0 / 0.18)' : 'none',
    '--oc-btn-radius': t.buttons === 'pill' ? '999px' : t.buttons === 'square' ? '2px' : '8px',
  }
}
