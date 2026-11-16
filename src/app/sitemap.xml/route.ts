import { db } from '@/lib/db'
import { getPublicOrigin, churchSiteUrl } from '@/lib/url'
import { isDemoModeEnabled } from '@/lib/demo-mode'

export const dynamic = 'force-dynamic'

/**
 * Root sitemap index — discovers every published church's sitemap plus the
 * platform's own public pages. Dashboard, onboarding, auth and private API
 * routes are deliberately excluded (robots.txt disallows them as well).
 *
 * Demonstration tenants are indexed only while demo mode is ON — once the
 * operator switches a deployment to production (DEMO_MODE=false), fictional
 * churches leave the sitemap (and their pages become noindex) so search
 * engines never mistake demo data for real congregations.
 */
export async function GET(req: Request) {
  const origin = getPublicOrigin(req.headers)
  const demoMode = isDemoModeEnabled()

  let churchSitemaps: string[] = []
  try {
    const churches = await db.church.findMany({
      where: { isPublished: true, status: 'ACTIVE', ...(demoMode ? {} : { isDemo: false }) },
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
