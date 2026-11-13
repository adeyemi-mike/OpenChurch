import { db } from '@/lib/db'
import { getPublicOrigin, churchSiteUrl } from '@/lib/url'

export const dynamic = 'force-dynamic'

/**
 * Root sitemap index — discovers every published church's sitemap plus the
 * platform's own public pages. Dashboard, onboarding, auth and private API
 * routes are deliberately excluded (robots.txt disallows them as well).
 */
export async function GET(req: Request) {
  const origin = getPublicOrigin(req.headers)

  let churchSitemaps: string[] = []
  try {
    const churches = await db.church.findMany({
      where: { isPublished: true, status: 'ACTIVE' },
      select: { slug: true },
      orderBy: { slug: 'asc' },
    })
    churchSitemaps = churches.map((c) => churchSiteUrl(origin, c.slug, 'sitemap.xml'))
  } catch {
    // Database unavailable — still serve the platform sitemap entry.
  }

  const entries = [
    `${origin}/sitemap-platform.xml`,
    ...churchSitemaps,
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (loc) => `  <sitemap>
    <loc>${loc}</loc>
  </sitemap>`
  )
  .join('\n')}
</sitemapindex>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
