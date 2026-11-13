/**
 * Central URL utility — the single source of truth for absolute public URLs.
 *
 * WHY THIS EXISTS
 * ---------------
 * OpenChurch deployments run behind reverse proxies that rewrite the Host
 * header (e.g. serverless gateways), so neither `Host` nor `X-Forwarded-Host`
 * can be trusted to be the public origin. Absolute URLs used for SEO
 * (canonical links, Open Graph images, sitemap entries, robots.txt) must
 * therefore resolve through an explicit chain:
 *
 *   1. NEXT_PUBLIC_SITE_URL  — operator-configured canonical origin
 *                              (recommended for every production deployment)
 *   2. Request origin        — derived from X-Forwarded-Proto + Host, used
 *                              only when it looks like a genuine public
 *                              origin (https and not a local/loopback host)
 *   3. http://localhost:3000 — development fallback only
 *
 * The request-origin branch is intentionally conservative: a proxy-rewritten
 * internal host (hostnames like *.fcapp.run, *.internal, or plain
 * localhost/loopback with a http scheme) must never leak into canonical or
 * Open Graph URLs.
 */

const DEFAULT_DEV_ORIGIN = 'http://localhost:3000'

/** Hosts that must never be treated as a public canonical origin. */
function isInternalHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h === '0.0.0.0' ||
    h === '[::1]' ||
    h.startsWith('127.') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    h.endsWith('.internal') ||
    h.endsWith('.local') ||
    // Serverless / private gateway rewrites (AliCloud FC, k8s svc names…)
    h.endsWith('.fcapp.run') ||
    h.endsWith('.svc') ||
    !h.includes('.')
  )
}

function configuredSiteUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.origin
  } catch {
    return null
  }
}

/**
 * Best-effort public origin from proxy headers. Returns null when the
 * headers do not describe a plausible public origin (the caller falls back
 * to the configured URL or the dev default).
 */
export function requestOrigin(headers?: Headers | null): string | null {
  if (!headers) return null
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  if (!host) return null
  const proto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'http'
  try {
    const origin = new URL(`${proto}://${host}`).origin
    if (proto === 'https' && !isInternalHost(new URL(origin).hostname)) {
      return origin
    }
    return null
  } catch {
    return null
  }
}

/**
 * The canonical public origin for the current request context.
 * Pass the request/async `headers()` when available; omit it for
 * context-free generation (falls back to configuration, then dev default).
 */
export function getPublicOrigin(headers?: Headers | null): string {
  const configured = configuredSiteUrl()
  if (configured) return configured
  const fromRequest = requestOrigin(headers)
  if (fromRequest) return fromRequest
  // Legacy variable, honoured only when it is not a localhost value.
  const legacy = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim()
  if (legacy) {
    try {
      const u = new URL(legacy)
      if (!isInternalHost(u.hostname)) return u.origin
    } catch {
      /* ignore malformed */
    }
  }
  return DEFAULT_DEV_ORIGIN
}

/** Join a site-relative path (starting with "/") onto an origin. */
export function absoluteUrl(origin: string, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${origin.replace(/\/$/, '')}${clean}`
}

/** Absolute URL of a church website root (or a path inside it). */
export function churchSiteUrl(origin: string, slug: string, path = ''): string {
  const suffix = path ? `/${path.replace(/^\//, '')}` : ''
  return absoluteUrl(origin, `/church/${slug}${suffix}`)
}

/**
 * Make a stored image URL absolute for Open Graph / Twitter metadata.
 * Relative media URLs (e.g. "/api/media/<id>/file") are resolved against
 * the origin; external http(s) URLs pass through unchanged; anything else
 * (data:, blobs, empty) returns null so callers can fall back to defaults.
 */
export function absoluteMediaUrl(origin: string, url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed)
      if (isInternalHost(u.hostname)) return null
      return u.toString()
    } catch {
      return null
    }
  }
  if (trimmed.startsWith('/')) return absoluteUrl(origin, trimmed)
  return null
}

/** Placeholder hosts that must never be rendered as a real link. */
const PLACEHOLDER_HOSTS = new Set([
  'example.com',
  'www.example.com',
  'example.org',
  'www.example.org',
  'example.net',
  'test.com',
  'domain.com',
  'yoursite.com',
  'yourwebsite.com',
])

/**
 * Social platform homepages. A bare platform root is a placeholder, not a
 * church profile — rendering it as the church's social link would point
 * visitors at the platform itself (e.g. "https://x.com/").
 */
const SOCIAL_PLATFORM_ROOTS = new Set([
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'tiktok.com',
  'www.tiktok.com',
  'linkedin.com',
  'www.linkedin.com',
  'wa.me',
  'api.whatsapp.com',
  'chat.whatsapp.com',
])

/**
 * Validate an externally-configured URL before rendering it as a link.
 *
 * Public-site buttons (social profiles, event registration, giving links,
 * online-service links…) are built from operator/church input. A value that
 * is empty, not a valid http(s) URL, an internal host, a known placeholder
 * ("example.com"), or a bare social-platform homepage returns null — the
 * caller MUST hide the link instead of rendering a broken/misleading one.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (isInternalHost(u.hostname)) return null
    const host = u.hostname.toLowerCase()
    if (PLACEHOLDER_HOSTS.has(host)) return null
    // A bare social-platform homepage has no profile path — it is a
    // placeholder, never a church's actual profile link.
    const path = u.pathname.replace(/\/+$/, '')
    if (SOCIAL_PLATFORM_ROOTS.has(host) && path === '') return null
    return u.toString()
  } catch {
    return null
  }
}
