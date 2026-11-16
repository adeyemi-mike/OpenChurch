import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import { storage } from '@/lib/storage'

/**
 * Serve media files.
 * - PUBLIC assets: served to anyone (used by public church websites).
 * - PRIVATE assets: require an authenticated member of the owning church.
 *
 * Hardening: nosniff + a restrictive CSP (blocks any script inside SVGs) and
 * immutable caching (stored names are unique per upload).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const asset = await db.mediaAsset.findUnique({ where: { id } })
  if (!asset) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (asset.visibility !== 'PUBLIC') {
    const user = await getSessionUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })
    const membership = await db.churchMembership.findFirst({
      where: { churchId: asset.churchId, userId: user.id },
      select: { id: true },
    })
    if (!membership) return new NextResponse('Forbidden', { status: 403 })
  }

  let data: Buffer
  try {
    data = await storage.get(`${asset.churchId}/${asset.storedName}`)
  } catch {
    return new NextResponse('File missing', { status: 404 })
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(data.byteLength),
      'Content-Disposition': `inline; filename="${encodeURIComponent(asset.fileName)}"`,
      // PUBLIC assets may be cached by shared proxies/CDNs. PRIVATE assets
      // must never be — `private` restricts caching to the end user's
      // browser, so an authenticated fetch cannot leak into a shared cache.
      'Cache-Control':
        asset.visibility === 'PUBLIC'
          ? 'public, max-age=31536000, immutable'
          : 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
}
