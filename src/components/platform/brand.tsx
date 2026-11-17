import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * OpenChurch brand components.
 *
 * Geometry is taken verbatim from the official brand set
 * (public/brand/openchurch-*.svg — see public/brand/README.txt):
 * an abstract geometric open-portal mark whose lower-right opening
 * suggests access, welcome and openness.
 *
 * Brand colours (public/brand/README.txt):
 *   deep green #1B5142 · warm off-white #FEFDFB ·
 *   soft cream #F6EFE1 · dark neutral #252B29
 * The platform's `--primary` token is this same deep green, so the default
 * lockup composes directly with the site palette.
 *
 * The wordmark is rendered as HTML text (Geist Sans) rather than SVG <text>
 * so it stays crisp, honours font fallbacks and inherits tracking/weight —
 * the brand files themselves specify "Inter with generic sans-serif
 * fallbacks", which the site font family satisfies.
 */

/** Standalone brand mark. Colour follows `currentColor` (set text-* on it). */
export function OpenChurchMark({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 112 112"
      fill="none"
      stroke="currentColor"
      strokeWidth={13}
      strokeLinecap="square"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      {...props}
    >
      <path d="M91 22H45C31 22 22 31 22 45V69C22 83 31 92 45 92H60" />
      <path d="M91 22V55L70 76" />
    </svg>
  )
}

/**
 * Horizontal brand lockup: mark + wordmark.
 *
 * - `default`  — deep green mark, "Open" bold green + "Church" dark neutral
 *                (mirrors public/brand/openchurch-primary.svg) for light
 *                surfaces.
 * - `reversed` — warm off-white throughout (mirrors
 *                openchurch-reversed.svg) for dark surfaces such as the
 *                console sidebar.
 */
export function OpenChurchLogo({
  variant = 'default',
  className,
}: {
  variant?: 'default' | 'reversed'
  className?: string
}) {
  const reversed = variant === 'reversed'
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <OpenChurchMark className={cn('size-8', reversed ? 'text-[#FEFDFB]' : 'text-primary')} />
      <span
        className={cn(
          'text-lg leading-none font-semibold tracking-tight',
          reversed ? 'text-[#FEFDFB]' : 'text-foreground'
        )}
      >
        <span className={cn('font-bold', reversed ? '' : 'text-primary')}>Open</span>Church
      </span>
    </span>
  )
}
