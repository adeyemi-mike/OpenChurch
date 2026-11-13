'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Upload, Search, ImagePlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import { cn } from '@/lib/utils'

type MediaItem = {
  id: string
  fileName: string
  url: string
  mimeType: string
  kind: string
  altText: string
  folder: string
}

/**
 * Pick an image from the church media library (or upload one on the spot).
 * Returns the selected asset's URL.
 */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  slug,
  title = 'Choose an image',
}: {
  open: boolean
  onClose: () => void
  onSelect: (url: string, alt: string) => void
  slug: string
  title?: string
}) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(
    async (search: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiFetch<{ items: MediaItem[] }>(
          `/api/dashboard/${slug}/media?kind=IMAGE&pageSize=48${search ? `&q=${encodeURIComponent(search)}` : ''}`
        )
        setItems(res.items)
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Could not load the media library.')
      } finally {
        setLoading(false)
      }
    },
    [slug]
  )

  useEffect(() => {
    if (open) load('')
     
  }, [open])

  async function upload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('altText', file.name.replace(/\.[a-z0-9]+$/i, ''))
      const asset = await apiFetch<MediaItem>(`/api/dashboard/${slug}/media`, {
        method: 'POST',
        body: fd,
      })
      toast.success('Upload complete')
      onSelect(asset.url, asset.altText)
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Choose from your media library, or upload a new image (JPEG, PNG, WebP or SVG up to 5&nbsp;MB).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Search files or alt text…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  load(q)
                }
              }}
              aria-label="Search media"
            />
          </div>
          <Button variant="outline" onClick={() => load(q)}>
            Search
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            Upload
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            className="sr-only"
            aria-label="Upload image file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              e.target.value = ''
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1" role="grid" aria-label="Media library">
          {loading ? (
            <div className="py-16 grid place-items-center text-muted-foreground" role="status">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : error ? (
            <p className="py-12 text-center text-sm text-destructive" role="alert">{error}</p>
          ) : items.length === 0 ? (
            <div className="py-14 text-center">
              <ImagePlus className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">No images yet — upload your first one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="gridcell"
                  onClick={() => {
                    onSelect(item.url, item.altText)
                    onClose()
                  }}
                  className="group relative rounded-lg overflow-hidden border focus-visible:ring-2 ring-ring"
                  title={item.altText || item.fileName}
                >
                  { }
                  <img
                    src={item.url}
                    alt={item.altText || item.fileName}
                    className="aspect-square w-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.fileName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
