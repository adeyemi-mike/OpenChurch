import 'server-only'
import { db } from '@/lib/db'
import { churchSiteUrl, getPublicOrigin } from '@/lib/url'

/**
 * Tenant resolution strategies.
 *
 * OpenChurch supports two routing modes:
 *
 * 1. PATH (default, works everywhere including the managed sandbox):
 *      https://host/church/<slug>/…
 * 2. HOST (opt-in for self-hosters with DNS control):
 *      https://<slug>.openchurch.example  (subdomain)
 *      https://www.churchname.org         (custom domain)
 *
 * In HOST mode an operator wires `resolveChurchByHost()` into their edge
 * middleware / reverse proxy (see docs/DEPLOYMENT.md → "Domains"). The
 * sandbox and default configuration use PATH mode, which requires no DNS.
 *
 * Domain *verification* (proving ownership of a custom domain) is NOT
 * implemented yet — `church_domains.isVerified` is stored but no DNS
 * challenge runs. This is an explicit open item, tracked in docs/FEATURES.md.
 */

export type ResolvedTenant = { churchId: string; slug: string } | null

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
  const hostname = host.split(':')[0].toLowerCase()
  if (!hostname.includes('.')) return null

  // Exact custom-domain match first.
  const custom = await db.churchDomain.findFirst({
    where: { domain: hostname, isVerified: true },
    select: { church: { select: { id: true, slug: true } } },
  })
  if (custom) return { churchId: custom.church.id, slug: custom.church.slug }

  // Subdomain of the deployment's own domain.
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN
  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    const sub = hostname.slice(0, -1 * (rootDomain.length + 1))
    if (!RESERVED_SUBDOMAINS.has(sub)) {
      const church = await db.church.findFirst({
        where: { slug: sub, status: 'ACTIVE' },
        select: { id: true, slug: true },
      })
      if (church) return { churchId: church.id, slug: church.slug }
    }
  }
  return null
}

export function isReservedSubdomain(slug: string): boolean {
  return RESERVED_SUBDOMAINS.has(slug)
}

/** Public URL for a church inside the current deployment (PATH mode).
 *  Routes through the central URL utility (see src/lib/url.ts) so canonical
 *  origins are resolved consistently everywhere. */
export function churchBaseUrl(slug: string): string {
  return churchSiteUrl(getPublicOrigin(), slug)
}
