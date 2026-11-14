import { db } from '@/lib/db'
import { getPublicOrigin, churchSiteUrl } from '@/lib/url'
import { getPrimaryDomain } from '@/lib/domains/service'

/**
 * Per-church robots.txt (served at /church/<slug>/robots.txt and, via the
 * proxy rewrite, at the root of the church's custom domain).
 *
 * Allows all crawlers, points at the church sitemap on the canonical
 * origin (the church's ACTIVE primary custom domain when one is set, the
 * platform origin otherwise). Dashboard/auth routes are excluded by the
 * platform robots.txt for platform-hosted traffic; a custom domain never
 * exposes them in the first place.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const church = await db.church.findFirst({
    where: { slug, status: 'ACTIVE', isPublished: true },
    select: { id: true, slug: true },
  })
  if (!church) {
    return new Response('Not found', { status: 404 })
  }
  const primary = await getPrimaryDomain(church.id)
  const base = primary ? `https://${primary}` : churchSiteUrl(getPublicOrigin(req.headers), church.slug)
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
