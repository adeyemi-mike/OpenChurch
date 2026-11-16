import { getPublicOrigin } from '@/lib/url'

/**
 * Platform-level sitemap: only genuinely public, indexable pages.
 * /login, /register and /forgot-password are authentication pages and are
 * excluded here (and disallowed via robots.txt).
 */
export async function GET(req: Request) {
  const origin = getPublicOrigin(req.headers)

  const urls = [
    { loc: `${origin}/`, priority: '1.0' },
    { loc: `${origin}/privacy`, priority: '0.3' },
    { loc: `${origin}/terms`, priority: '0.3' },
    { loc: `${origin}/license`, priority: '0.2' },
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
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
