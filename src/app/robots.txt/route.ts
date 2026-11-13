import { db } from '@/lib/db'
import { getPublicOrigin, churchSiteUrl } from '@/lib/url'

export const dynamic = 'force-dynamic'

/**
 * robots.txt — crawler guidance only, NOT an access-control mechanism.
 * Dashboard/onboarding/auth/API routes are protected by authentication and
 * server-side authorisation regardless of what robots.txt says.
 */
export async function GET(req: Request) {
  const origin = getPublicOrigin(req.headers)

  const lines = [
    'User-agent: *',
    'Allow: /',
    // Console is the current dashboard route; /dashboard is kept for any
    // older crawl profiles (the platform gateway also owns that path).
    'Disallow: /console',
    'Disallow: /dashboard',
    'Disallow: /onboarding',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /forgot-password',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
  ]

  // Multi-tenant: every published church also exposes its own sitemap.
  try {
    const churches = await db.church.findMany({
      where: { isPublished: true, status: 'ACTIVE' },
      select: { slug: true },
      orderBy: { slug: 'asc' },
    })
    for (const c of churches) {
      lines.push(`Sitemap: ${churchSiteUrl(origin, c.slug, 'sitemap.xml')}`)
    }
  } catch {
    // Database unavailable — root sitemap line above still valid.
  }

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
