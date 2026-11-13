import 'server-only'
import { mkdir, readFile, writeFile, unlink, stat } from 'fs/promises'
import path from 'path'

/**
 * Storage abstraction for the media library.
 *
 * The `StorageDriver` interface keeps the media system independent of where
 * files physically live. The local driver (default) writes under
 * STORAGE_PATH — safe for self-hosted single-node deployments. S3/Supabase
 * Storage drivers can be contributed by implementing this interface
 * (see docs/ARCHITECTURE.md → "Storage").
 */

export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

const ROOT = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.join(process.cwd(), 'storage', 'uploads')

/** Storage keys are `${churchId}/${storedName}` — reject anything suspicious. */
function safeKey(key: string): string {
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(key)) {
    throw new Error('Invalid storage key')
  }
  const full = path.join(ROOT, key)
  if (!full.startsWith(ROOT)) throw new Error('Invalid storage key')
  return full
}

class LocalDriver implements StorageDriver {
  async put(key: string, data: Buffer): Promise<void> {
    const full = safeKey(key)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, data)
  }
  async get(key: string): Promise<Buffer> {
    return readFile(safeKey(key))
  }
  async delete(key: string): Promise<void> {
    try {
      await unlink(safeKey(key))
    } catch {
      // deleting a missing file is a no-op
    }
  }
  async exists(key: string): Promise<boolean> {
    try {
      await stat(safeKey(key))
      return true
    } catch {
      return false
    }
  }
}

export const storage: StorageDriver = new LocalDriver()

export function storageKey(churchId: string, storedName: string): string {
  return `${churchId}/${storedName}`
}

// ---------------------------------------------------------------------------
// Upload validation — enforced server-side, always.
// ---------------------------------------------------------------------------

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10 MB

export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

export const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
])

export function mimeKind(mime: string): 'IMAGE' | 'DOCUMENT' | null {
  if (IMAGE_MIME_TYPES.has(mime)) return 'IMAGE'
  if (DOCUMENT_MIME_TYPES.has(mime)) return 'DOCUMENT'
  return null
}

export function maxBytesForKind(kind: 'IMAGE' | 'DOCUMENT'): number {
  return kind === 'IMAGE' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES
}

/** Generate an unguessable stored filename, preserving a sanitised extension. */
export function makeStoredName(originalName: string): string {
  const ext = (originalName.split('.').pop() ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .slice(0, 10)
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  return ext ? `${rand}.${ext}` : rand
}
