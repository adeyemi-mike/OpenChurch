import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError } from '@/lib/api/handler'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import {
  storage,
  storageKey,
  makeStoredName,
  mimeKind,
  maxBytesForKind,
} from '@/lib/storage'

export const GET = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'media:manage')
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const kind = url.searchParams.get('kind') ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(48, Math.max(6, Number(url.searchParams.get('pageSize') ?? '24') || 24))

  const where = {
    churchId: ctx.churchId,
    ...(kind === 'IMAGE' || kind === 'DOCUMENT' ? { kind } : {}),
    ...(q
      ? {
          OR: [
            { fileName: { contains: q } },
            { altText: { contains: q } },
            { folder: { contains: q } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    db.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.mediaAsset.count({ where }),
  ])

  return ok({
    items: items.map(toDto),
    total,
    page,
    pageSize,
  })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const ctx = await requireChurch(slug, 'media:manage')

  const form = await req.formData().catch(() => {
    throw new ApiError(400, 'Expected a multipart form upload.', 'BAD_FORM')
  })
  const file = form.get('file')
  if (!(file instanceof File)) throw new ApiError(400, 'No file provided.', 'NO_FILE')
  const altText = String(form.get('altText') ?? '').slice(0, 200)
  const folder = String(form.get('folder') ?? '').slice(0, 60)

  const kind = mimeKind(file.type)
  if (!kind) {
    throw new ApiError(415, 'Unsupported file type. Images (JPEG, PNG, WebP, GIF, SVG) and documents (PDF, DOCX, TXT, CSV) are allowed.', 'BAD_MIME')
  }
  const maxBytes = maxBytesForKind(kind)
  if (file.size > maxBytes) {
    throw new ApiError(413, `File too large — the limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`, 'TOO_LARGE')
  }
  if (file.size === 0) throw new ApiError(400, 'The file is empty.', 'EMPTY_FILE')

  let buffer = Buffer.from(await file.arrayBuffer())

  // Sanitise SVG uploads (strip scripts / event handlers) — served inline.
  if (file.type === 'image/svg+xml') {
    const text = buffer.toString('utf8')
    if (/<script[\s\S]*?<\/script>/gi.test(text) || /\son\w+\s*=/i.test(text) || /javascript:/i.test(text)) {
      throw new ApiError(422, 'For safety, SVG files containing scripts or event handlers are rejected.', 'UNSAFE_SVG')
    }
  }

  // Read image dimensions where possible (non-blocking failure).
  let width: number | null = null
  let height: number | null = null
  if (kind === 'IMAGE' && file.type !== 'image/svg+xml') {
    try {
      const sharpModule = await import('sharp')
      const meta = await sharpModule.default(buffer).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
    } catch {
      /* dimensions are optional metadata */
    }
  }

  const storedName = makeStoredName(file.name)
  const key = storageKey(ctx.churchId, storedName)
  await storage.put(key, buffer)

  const asset = await db.mediaAsset.create({
    data: {
      churchId: ctx.churchId,
      fileName: file.name.slice(0, 200),
      storedName,
      mimeType: file.type,
      kind,
      sizeBytes: buffer.byteLength,
      width,
      height,
      altText,
      folder,
      visibility: 'PUBLIC',
      uploadedById: ctx.user.id,
    },
  })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.mediaUploaded,
    entityType: 'media',
    entityId: asset.id,
    metadata: { fileName: asset.fileName, kind, sizeBytes: asset.sizeBytes },
  })

  return ok(toDto(asset), { status: 201 })
})

function toDto(a: {
  id: string
  fileName: string
  mimeType: string
  kind: string
  sizeBytes: number
  altText: string
  folder: string
  createdAt: Date
}) {
  return {
    id: a.id,
    fileName: a.fileName,
    url: `/api/media/${a.id}/file`,
    mimeType: a.mimeType,
    kind: a.kind,
    sizeBytes: a.sizeBytes,
    altText: a.altText,
    folder: a.folder,
    createdAt: a.createdAt.toISOString(),
  }
}
