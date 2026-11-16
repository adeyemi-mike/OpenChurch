import 'server-only'
import { db } from '@/lib/db'
import { churchSiteUrl, getPublicOrigin } from '@/lib/url'
import { getCachedHostResolution, setCachedHostResolution } from '@/lib/domains/cache'

/**
 * Tenant resolution strategies.
 *
 * OpenChurch supports two routing modes:
 *
 * 1. PATH (default, works everywhere including the managed sandbox):
 *      https://host/church/<slug>/…
 * 2. HOST (custom domains + optional subdomains):
 *      https://www.churchname.org  (verified custom domain — primary mode)
 *      https://<slug>.openchurch.example  (subdomain, PLATFORM_ROOT_DOMAIN)
 *
 * Custom domains are managed end-to-end from the church dashboard
 * (Website Settings → Custom domains): TXT ownership verification, provider
 * hosting assignment, primary-domain selection and removal. The resolver
 * only ever serves domains with status ACTIVE — added-but-unverified or
 * removed hostnames never select a tenant.
 *
 * Canonical-host enforcement: when the resolved host is one of the church's
 * ACTIVE NON-PRIMARY domains and a primary domain exists, the proxy issues a
 * permanent redirect to the same path on the primary (this is how www ↔ apex
 * relationships are handled — e.g. gracecommunity.org → www.gracecommunity.org).
 *
 * Resolution results are cached briefly (60s TTL) — see lib/domains/cache.
 */

export type ResolvedTenant = {
  churchId: string
  slug: string
  /** Matched custom-domain hostname (null when resolved via platform subdomain). */
  domain: string | null
  /** True when the matched host is the church's primary (canonical) domain. */
  isPrimaryDomain: boolean
  /** The church's primary ACTIVE domain, when one exists. */
  primaryDomain: string | null
} | null

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'admin',
  'api',
  'staging',
  'demo',
  'openchurch',
  'mail',
  'docs',
])

export async function resolveChurchByHost(host: string): Promise<ResolvedTenant> {
  const hostname = host.split(':')[0].toLowerCase().replace(/\.$/, '')
  if (!hostname.includes('.')) return null

  // Exact custom-domain match (cache-first). Only ACTIVE domains resolve.
  const cached = getCachedHostResolution(hostname)
  if (cached !== undefined) return cached

  const custom = await db.churchDomain.findFirst({
    where: { domain: hostname, status: 'ACTIVE' },
    select: {
      churchId: true,
      church: { select: { id: true, slug: true, status: true } },
    },
  })
  if (custom && custom.church.status === 'ACTIVE') {
    const resolved = await resolveWithPrimary(hostname, custom.church.id, custom.church.slug)
    setCachedHostResolution(hostname, resolved)
    return resolved
  }

  // Subdomain of the deployment's own domain.
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase()
  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    const sub = hostname.slice(0, -1 * (rootDomain.length + 1))
    if (!RESERVED_SUBDOMAINS.has(sub)) {
      const church = await db.church.findFirst({
        where: { slug: sub, status: 'ACTIVE' },
        select: { id: true, slug: true },
      })
      if (church) {
        const resolved: NonNullable<ResolvedTenant> = {
          churchId: church.id,
          slug: church.slug,
          domain: null,
          isPrimaryDomain: false,
          primaryDomain: null,
        }
        setCachedHostResolution(hostname, resolved)
        return resolved
      }
    }
  }

  // Negative caching keeps unknown hosts from hammering the database.
  setCachedHostResolution(hostname, null)
  return null
}

/** Enrich a custom-domain match with the church's primary domain. */
async function resolveWithPrimary(
  hostname: string,
  churchId: string,
  slug: string
): Promise<NonNullable<ResolvedTenant>> {
  const primary = await db.churchDomain.findFirst({
    where: { churchId, status: 'ACTIVE', isPrimary: true },
    select: { domain: true },
  })
  return {
    churchId,
    slug,
    domain: hostname,
    isPrimaryDomain: primary?.domain === hostname,
    primaryDomain: primary?.domain ?? null,
  }
}

/**
 * Canonical-host redirect decision (pure — unit-tested).
 *
 * Returns the absolute URL the proxy should 308-redirect to, or null when
 * the request should be served as-is. Only fires for a church's own ACTIVE
 * NON-PRIMARY custom domain when a primary exists — platform subdomain
 * traffic, platform paths and the primary host itself are never redirected.
 */
export function canonicalRedirectFor(
  resolved: NonNullable<ResolvedTenant>,
  path: string,
  search: string
): string | null {
  if (!resolved.domain) return null // platform subdomain (or primary-less)
  if (resolved.isPrimaryDomain) return null
  if (!resolved.primaryDomain) return null
  if (resolved.primaryDomain === resolved.domain) return null
  // Defensive: a path with an embedded query must not double the search.
  const pathOnly = path.split('?')[0]
  const cleanPath = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`
  const qs = search || (path.includes('?') ? `?${path.split('?').slice(1).join('?')}` : '')
  return `https://${resolved.primaryDomain}${cleanPath === '/' ? '/' : cleanPath}${qs}`
}

/**
 * Is this hostname one of the deployment's OWN origins (never a church
 * domain)? Used by the proxy to decide whether host-based tenant routing
 * should even be attempted for a request.
 */
export function isPlatformHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  for (const envVar of ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_APP_URL']) {
    const raw = process.env[envVar]?.trim()
    if (!raw) continue
    try {
      const u = new URL(raw.includes('://') ? raw : `https://${raw}`)
      if (u.hostname === h) return true
    } catch {
      /* ignore malformed */
    }
  }
  const root = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase()
  if (root && (h === root || h.endsWith(`.${root}`))) return true
  // Local/dev and preview hosts are platform traffic.
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.localhost')) return true
  return false
}

export function isReservedSubdomain(slug: string): boolean {
  return RESERVED_SUBDOMAINS.has(slug)
}

/**
 * The addresses a church automatically receives on this deployment:
 * the PATH URL (always) and, when the operator configured a platform root
 * domain with wildcard DNS, the subdomain URL.
 */
export function churchPlatformAddresses(slug: string): {
  pathUrl: string
  subdomainUrl: string | null
} {
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase()
  return {
    pathUrl: churchBaseUrl(slug),
    subdomainUrl: rootDomain ? `https://${slug}.${rootDomain}` : null,
  }
}

/** Public URL for a church inside the current deployment (PATH mode).
 *  Routes through the central URL utility (see src/lib/url.ts) so canonical
 *  origins are resolved consistently everywhere. */
export function churchBaseUrl(slug: string): string {
  return churchSiteUrl(getPublicOrigin(), slug)
}
