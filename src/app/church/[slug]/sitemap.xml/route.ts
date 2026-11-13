import { db } from '@/lib/db'
import { getPublicOrigin, churchSiteUrl } from '@/lib/url'

/** XML sitemap for a church website (published, public content only).
 *
 * Includes:
 *   - the church homepage,
 *   - every PUBLISHED CMS page (about, contact, custom pages…),
 *   - every PUBLISHED sermon's detail page.
 *
 * Deliberately excluded: drafts, archived records, dashboard/console/auth
 * routes and any private administrative resource. Events, giving, ministries
 * and the sermon archive are sections of the homepage/CMS pages, so their
 * public URLs are already covered here — individual sermons are the only
 * content with their own detail URLs.
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

  const [pages, sermons] = await Promise.all([
    db.websitePage.findMany({
      where: { churchId: church.id, status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    }),
    db.sermon.findMany({
      where: { churchId: church.id, status: 'PUBLISHED' },
      select: { id: true, updatedAt: true },
      orderBy: { preachedAt: 'desc' },
      // Sitemap protocol caps a sitemap at 50,000 entries; a church archive
      // stays far below that, but the bound keeps the query predictable.
      take: 5000,
    }),
  ])

  // Canonical origin: explicit configuration first, then a plausible public
  // request origin. Never localhost in production deployments.
  const origin = getPublicOrigin(req.headers)
  const base = churchSiteUrl(origin, church.slug)
  const urls = [
    { loc: base, lastmod: new Date().toISOString().slice(0, 10) },
    ...pages
      .filter((p) => p.slug !== '')
      .map((p) => ({
        loc: `${base}/${p.slug}`,
        lastmod: p.updatedAt.toISOString().slice(0, 10),
      })),
    ...sermons.map((s) => ({
      loc: `${base}/sermons/${s.id}`,
      lastmod: s.updatedAt.toISOString().slice(0, 10),
    })),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
