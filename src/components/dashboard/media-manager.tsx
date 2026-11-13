'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  FileText,
  Images,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import { can, type ChurchRole } from '@/lib/permissions'

type MediaItem = {
  id: string
  fileName: string
  url: string
  mimeType: string
  kind: string
  sizeBytes: number
  altText: string
  folder: string
  createdAt: string
}

type MediaListResponse = {
  items: MediaItem[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 24

/**
 * multipart upload — apiFetch skips the JSON content-type for FormData
 * bodies (the browser sets the multipart boundary) and attaches the CSRF
 * double-submit header required behind Host-rewriting gateways.
 */
async function uploadMedia(url: string, form: FormData): Promise<void> {
  await apiFetch(url, { method: 'POST', body: form })
}

function altFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .slice(0, 200)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function MediaManager({ slug, role }: { slug: string; role: ChurchRole }) {
  const canManage = can(role, 'media:manage')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [kind, setKind] = useState('')

  const [uploading, setUploading] = useState<string[]>([])

  const [detail, setDetail] = useState<MediaItem | null>(null)
  const [detailAlt, setDetailAlt] = useState('')
  const [detailFolder, setDetailFolder] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)
  const [deletingDetail, setDeletingDetail] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (kind === 'IMAGE' || kind === 'DOCUMENT') params.set('kind', kind)
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      const res = await apiFetch<MediaListResponse>(
        `/api/dashboard/${slug}/media?${params.toString()}`
      )
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load media.')
    } finally {
      setLoading(false)
    }
  }, [slug, debouncedQuery, kind, page])

  useEffect(() => {
    load()
  }, [load])

  function reloadAfterChange() {
    // Step back a page when the last item of a non-first page is removed,
    // otherwise simply refresh the current view.
    if (items.length <= 1 && page > 1) setPage((p) => p - 1)
    else load()
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    let succeeded = 0
    for (const file of files) {
      setUploading((u) => [...u, file.name])
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('altText', altFromFilename(file.name))
        await uploadMedia(`/api/dashboard/${slug}/media`, form)
        succeeded += 1
      } catch (err) {
        toast.error(
          err instanceof ApiClientError ? err.message : `Could not upload “${file.name}”.`
        )
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name))
      }
    }
    if (succeeded > 0) {
      toast.success(succeeded === 1 ? 'Upload complete.' : `${succeeded} files uploaded.`)
      if (page !== 1) setPage(1)
      else load()
    }
  }

  function openDetail(item: MediaItem) {
    setDetail(item)
    setDetailAlt(item.altText)
    setDetailFolder(item.folder)
  }

  async function saveDetail() {
    if (!detail) return
    setSavingDetail(true)
    try {
      const saved = await apiFetch<{ id: string; altText: string; folder: string }>(
        `/api/dashboard/${slug}/media/${detail.id}`,
        { method: 'PATCH', body: JSON.stringify({ altText: detailAlt, folder: detailFolder }) }
      )
      setItems((prev) =>
        prev.map((it) =>
          it.id === saved.id ? { ...it, altText: saved.altText, folder: saved.folder } : it
        )
      )
      toast.success('Details saved.')
      setDetail(null)
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save details.')
    } finally {
      setSavingDetail(false)
    }
  }

  async function copyUrl() {
    if (!detail) return
    try {
      const absolute = new URL(detail.url, window.location.origin).toString()
      await navigator.clipboard.writeText(absolute)
      toast.success('URL copied')
    } catch {
      toast.error('Could not copy the URL.')
    }
  }

  async function deleteDetail() {
    if (!detail) return
    if (!confirm(`Delete “${detail.fileName}”? This cannot be undone.`)) return
    setDeletingDetail(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/media/${detail.id}`, { method: 'DELETE' })
      toast.success('File deleted.')
      setDetail(null)
      reloadAfterChange()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the file.')
      setDeletingDetail(false)
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)
  const hasFilters = Boolean(debouncedQuery) || Boolean(kind)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Media Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload and organise the images and documents used across your website.
          </p>
        </div>
        {canManage ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,.pdf,.docx,.txt,.csv"
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ''
              }}
              aria-label="Choose files to upload"
            />
            <Button
              className="h-11"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading.length > 0}
            >
              {uploading.length > 0 ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              {uploading.length > 0 ? 'Uploading…' : 'Upload files'}
            </Button>
          </>
        ) : null}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="h-11 pl-9"
            placeholder="Search files, alt text, folders…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            aria-label="Search media"
          />
        </div>
        <Select
          value={kind || 'ALL'}
          onValueChange={(v) => {
            setKind(v === 'ALL' ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-11 w-full sm:w-44" aria-label="Filter by kind">
            <SelectValue placeholder="All kinds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All kinds</SelectItem>
            <SelectItem value="IMAGE">Images</SelectItem>
            <SelectItem value="DOCUMENT">Documents</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => load()}
          disabled={loading}
          aria-label="Refresh media library"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </Button>
      </div>

      {/* Per-file upload progress */}
      {uploading.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-live="polite">
          {uploading.map((name) => (
            <li
              key={name}
              className="inline-flex max-w-full items-center gap-2 rounded-full border bg-muted/50 px-3 py-1.5 text-xs"
            >
              <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
              <span className="truncate">{name}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : loading ? (
        <div className="grid place-items-center py-20 text-muted-foreground" role="status">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Images className="mx-auto size-8 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">
            {hasFilters ? 'No media match your search' : 'No media yet'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters
              ? 'Try a different search term or filter.'
              : 'Upload your first image or document.'}
          </p>
          {canManage && !hasFilters ? (
            <Button className="mt-5 h-11" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" aria-hidden /> Upload files
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openDetail(item)}
                  className="group w-full overflow-hidden rounded-xl border bg-background text-left shadow-xs transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  aria-label={`Open ${item.fileName}`}
                >
                  {item.kind === 'IMAGE' ? (
                    <img
                      src={item.url}
                      alt={item.altText || item.fileName}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="grid aspect-square w-full place-items-center bg-muted">
                      <FileText className="size-10 text-muted-foreground/60" aria-hidden />
                    </span>
                  )}
                  <span className="block p-3">
                    <span className="block truncate text-sm font-medium">{item.fileName}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {formatBytes(item.sizeBytes)}
                      {item.folder ? ` · ${item.folder}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" role="status">
              {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => setPage((p) => (rangeEnd < total ? p + 1 : p))}
                disabled={rangeEnd >= total}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-6">{detail.fileName}</DialogTitle>
                <DialogDescription>
                  {formatBytes(detail.sizeBytes)} · {detail.mimeType}
                  {detail.folder ? ` · ${detail.folder}` : ''}
                </DialogDescription>
              </DialogHeader>

              {detail.kind === 'IMAGE' ? (
                <div className="grid max-h-80 place-items-center overflow-hidden rounded-xl bg-muted p-2">
                  <img
                    src={detail.url}
                    alt={detailAlt || detail.fileName}
                    className="max-h-72 w-full object-contain"
                  />
                </div>
              ) : (
                <div className="grid place-items-center rounded-xl bg-muted p-8">
                  <FileText className="size-12 text-muted-foreground/60" aria-hidden />
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="media-alt">Alt text</Label>
                  <Input
                    id="media-alt"
                    value={detailAlt}
                    onChange={(e) => setDetailAlt(e.target.value)}
                    placeholder="Describe the image for screen readers"
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="media-folder">Folder</Label>
                  <Input
                    id="media-folder"
                    value={detailFolder}
                    onChange={(e) => setDetailFolder(e.target.value)}
                    placeholder="e.g. banners"
                    disabled={!canManage}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                {canManage ? (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={deleteDetail}
                    disabled={deletingDetail}
                    aria-label={`Delete ${detail.fileName}`}
                  >
                    {deletingDetail ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                    Delete
                  </Button>
                ) : null}
                <div className="flex flex-1 flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={copyUrl}>
                    Copy URL
                  </Button>
                  {canManage ? (
                    <Button onClick={saveDetail} disabled={savingDetail}>
                      {savingDetail ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : null}
                      Save
                    </Button>
                  ) : null}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
