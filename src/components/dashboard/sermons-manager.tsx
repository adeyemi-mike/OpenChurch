'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
  BookOpen,
  ImagePlus,
  Video,
  Headphones,
  FileText,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MediaPicker } from '@/components/builder/media-picker'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import type { ChurchRole } from '@/lib/permissions'

type SermonRow = {
  id: string
  title: string
  speakerName: string
  preachedAt: string
  description: string | null
  scriptureRef: string | null
  seriesId: string | null
  seriesTitle: string | null
  imageUrl: string | null
  videoUrl: string | null
  audioUrl: string | null
  notesUrl: string | null
  status: string
}

type SeriesRow = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
}

type SermonForm = {
  title: string
  speakerName: string
  preachedAt: string
  scriptureRef: string
  seriesId: string // 'none' or a series id
  description: string
  videoUrl: string
  audioUrl: string
  notesUrl: string
  imageUrl: string
  status: string
}

type SeriesForm = {
  title: string
  description: string
  imageUrl: string
}

const NONE_SERIES = 'none'

function emptySermonForm(): SermonForm {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    title: '',
    speakerName: '',
    preachedAt: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    scriptureRef: '',
    seriesId: NONE_SERIES,
    description: '',
    videoUrl: '',
    audioUrl: '',
    notesUrl: '',
    imageUrl: '',
    status: 'DRAFT',
  }
}

const EMPTY_SERIES_FORM: SeriesForm = { title: '', description: '', imageUrl: '' }

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'PUBLISHED' ? 'default' : status === 'DRAFT' ? 'secondary' : 'outline'
  const label = status === 'PUBLISHED' ? 'Published' : status === 'DRAFT' ? 'Draft' : 'Archived'
  return <Badge variant={variant}>{label}</Badge>
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function SermonsManager({ slug, role }: { slug: string; role: ChurchRole }) {
  const [sermons, setSermons] = useState<SermonRow[]>([])
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SermonRow | null>(null)
  const [form, setForm] = useState<SermonForm>(emptySermonForm)
  const [saving, setSaving] = useState(false)

  const [seriesOpen, setSeriesOpen] = useState(true)
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<SeriesRow | null>(null)
  const [seriesForm, setSeriesForm] = useState<SeriesForm>(EMPTY_SERIES_FORM)
  const [savingSeries, setSavingSeries] = useState(false)

  const [pickerTarget, setPickerTarget] = useState<'sermon' | 'series' | null>(null)

  const isAuthor = role === 'AUTHOR'

  const loadSermons = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ sermons: SermonRow[] }>(`/api/dashboard/${slug}/sermons`)
      setSermons(res.sermons)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load sermons.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  const loadSeries = useCallback(async () => {
    try {
      const res = await apiFetch<{ series: SeriesRow[] }>(`/api/dashboard/${slug}/series`)
      setSeries(res.series)
    } catch {
      // The series picker simply stays empty — sermons still work without it.
      setSeries([])
    }
  }, [slug])

  useEffect(() => {
    loadSermons()
    loadSeries()
  }, [loadSermons, loadSeries])

  function setField<K extends keyof SermonForm>(key: K, value: SermonForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setSeriesField<K extends keyof SeriesForm>(key: K, value: SeriesForm[K]) {
    setSeriesForm((f) => ({ ...f, [key]: value }))
  }

  function openCreate() {
    setEditing(null)
    setForm(emptySermonForm())
    setDialogOpen(true)
  }

  function openEdit(sermon: SermonRow) {
    setEditing(sermon)
    setForm({
      title: sermon.title,
      speakerName: sermon.speakerName,
      preachedAt: sermon.preachedAt.slice(0, 10),
      scriptureRef: sermon.scriptureRef ?? '',
      seriesId: sermon.seriesId ?? NONE_SERIES,
      description: sermon.description ?? '',
      videoUrl: sermon.videoUrl ?? '',
      audioUrl: sermon.audioUrl ?? '',
      notesUrl: sermon.notesUrl ?? '',
      imageUrl: sermon.imageUrl ?? '',
      status: sermon.status,
    })
    setDialogOpen(true)
  }

  async function save() {
    if (form.title.trim().length < 2) {
      toast.error('Give the sermon a title (at least 2 characters).')
      return
    }
    if (form.speakerName.trim().length < 2) {
      toast.error('Who preached it? Add the speaker name.')
      return
    }
    if (!form.preachedAt) {
      toast.error('Pick the date it was preached.')
      return
    }
    setSaving(true)
    // Authors cannot set the status — the server forces drafts anyway.
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      speakerName: form.speakerName.trim(),
      preachedAt: form.preachedAt,
      scriptureRef: form.scriptureRef,
      seriesId: form.seriesId === NONE_SERIES ? '' : form.seriesId,
      description: form.description,
      videoUrl: form.videoUrl.trim(),
      audioUrl: form.audioUrl.trim(),
      notesUrl: form.notesUrl.trim(),
      imageUrl: form.imageUrl.trim(),
    }
    if (!isAuthor) payload.status = form.status
    try {
      if (editing) {
        await apiFetch(`/api/dashboard/${slug}/sermons/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast.success('Sermon updated.')
      } else {
        await apiFetch(`/api/dashboard/${slug}/sermons`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Sermon saved as a draft.')
      }
      setDialogOpen(false)
      loadSermons()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the sermon.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(sermon: SermonRow) {
    if (!confirm(`Delete “${sermon.title}”? This cannot be undone.`)) return
    try {
      await apiFetch(`/api/dashboard/${slug}/sermons/${sermon.id}`, { method: 'DELETE' })
      toast.success('Sermon deleted.')
      loadSermons()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the sermon.')
    }
  }

  function openCreateSeries() {
    setEditingSeries(null)
    setSeriesForm(EMPTY_SERIES_FORM)
    setSeriesDialogOpen(true)
  }

  function openEditSeries(row: SeriesRow) {
    setEditingSeries(row)
    setSeriesForm({
      title: row.title,
      description: row.description ?? '',
      imageUrl: row.imageUrl ?? '',
    })
    setSeriesDialogOpen(true)
  }

  async function saveSeries() {
    if (seriesForm.title.trim().length < 2) {
      toast.error('Give the series a title (at least 2 characters).')
      return
    }
    setSavingSeries(true)
    const payload = {
      title: seriesForm.title.trim(),
      description: seriesForm.description,
      imageUrl: seriesForm.imageUrl.trim(),
    }
    try {
      if (editingSeries) {
        await apiFetch(`/api/dashboard/${slug}/series/${editingSeries.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast.success('Series updated.')
      } else {
        await apiFetch(`/api/dashboard/${slug}/series`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Series created.')
      }
      setSeriesDialogOpen(false)
      loadSeries()
      loadSermons() // sermon cards show the series title
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the series.')
    } finally {
      setSavingSeries(false)
    }
  }

  async function removeSeries(row: SeriesRow) {
    if (!confirm(`Delete series “${row.title}”? Sermons in it are kept — they just lose the grouping.`)) return
    try {
      await apiFetch(`/api/dashboard/${slug}/series/${row.id}`, { method: 'DELETE' })
      toast.success('Series deleted.')
      loadSeries()
      loadSermons()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the series.')
    }
  }

  const filtered = sermons.filter((s) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      s.title.toLowerCase().includes(q) ||
      s.speakerName.toLowerCase().includes(q) ||
      (s.seriesTitle ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sermons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build your church’s message archive — video, audio and notes, newest first.
          </p>
        </div>
        <Button className="min-h-11" onClick={openCreate}>
          <Plus className="size-4" aria-hidden /> New sermon
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Search by title, speaker or series…"
          className="pl-9 min-h-11"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search sermons"
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-muted-foreground" role="status">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <BookOpen className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">{sermons.length === 0 ? 'No sermons yet' : 'No sermons match your search'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {sermons.length === 0
              ? 'Record and share your messages — add your first sermon.'
              : 'Try a different search term.'}
          </p>
          {sermons.length === 0 ? (
            <Button className="mt-5 min-h-11" onClick={openCreate}>
              <Plus className="size-4" aria-hidden /> New sermon
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((sermon) => (
            <li key={sermon.id} className="rounded-2xl border bg-background p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary shrink-0" aria-hidden>
                    <BookOpen className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{sermon.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {sermon.speakerName} · {formatDate(sermon.preachedAt)}
                    </p>
                  </div>
                </div>
                <StatusBadge status={sermon.status} />
              </div>

              {sermon.seriesTitle || sermon.scriptureRef || sermon.videoUrl || sermon.audioUrl || sermon.notesUrl ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sermon.seriesTitle ? <Badge variant="secondary">{sermon.seriesTitle}</Badge> : null}
                  {sermon.scriptureRef ? <Badge variant="outline">{sermon.scriptureRef}</Badge> : null}
                  {sermon.videoUrl ? (
                    <Badge variant="outline">
                      <Video className="size-3" aria-hidden /> Video
                    </Badge>
                  ) : null}
                  {sermon.audioUrl ? (
                    <Badge variant="outline">
                      <Headphones className="size-3" aria-hidden /> Audio
                    </Badge>
                  ) : null}
                  {sermon.notesUrl ? (
                    <Badge variant="outline">
                      <FileText className="size-3" aria-hidden /> Notes
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              {sermon.description ? (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{sermon.description}</p>
              ) : null}

              <div className="mt-auto pt-4 border-t flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  className="size-11"
                  onClick={() => openEdit(sermon)}
                  aria-label={`Edit ${sermon.title}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  className="size-11 text-destructive hover:text-destructive"
                  onClick={() => remove(sermon)}
                  aria-label={`Delete ${sermon.title}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Sermon series ------------------------------------------------- */}
      <Collapsible open={seriesOpen} onOpenChange={setSeriesOpen} className="rounded-2xl border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Layers className="size-4 text-primary" aria-hidden /> Sermon series
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Group related messages — e.g. “Romans: The Gospel of God”.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="min-h-11" onClick={openCreateSeries}>
              <Plus className="size-4" aria-hidden /> New series
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="min-h-11" aria-expanded={seriesOpen}>
                {seriesOpen ? (
                  <ChevronUp className="size-4" aria-hidden />
                ) : (
                  <ChevronDown className="size-4" aria-hidden />
                )}
                {seriesOpen ? 'Hide' : 'Show'}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="px-5 pb-5">
            {series.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No series yet — create one to start grouping sermons.
              </p>
            ) : (
              <ul className="max-h-96 overflow-y-auto space-y-2 pr-1 [scrollbar-width:thin]">
                {series.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{row.title}</p>
                      {row.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-1">{row.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        className="size-11"
                        onClick={() => openEditSeries(row)}
                        aria-label={`Edit series ${row.title}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        className="size-11 text-destructive hover:text-destructive"
                        onClick={() => removeSeries(row)}
                        aria-label={`Delete series ${row.title}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Sermon dialog ------------------------------------------------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit sermon' : 'New sermon'}</DialogTitle>
            <DialogDescription>
              The details people see in the archive — links to video, audio and notes are optional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-title">Title *</Label>
              <Input
                id="s-title"
                className="min-h-11"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="e.g. The God Who Restores"
                autoFocus={!editing}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-speaker">Speaker *</Label>
                <Input
                  id="s-speaker"
                  className="min-h-11"
                  value={form.speakerName}
                  onChange={(e) => setField('speakerName', e.target.value)}
                  placeholder="e.g. Pastor Grace Bello"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-date">Date preached *</Label>
                <Input
                  id="s-date"
                  type="date"
                  className="min-h-11"
                  value={form.preachedAt}
                  onChange={(e) => setField('preachedAt', e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-scripture">Scripture reference</Label>
                <Input
                  id="s-scripture"
                  className="min-h-11"
                  value={form.scriptureRef}
                  onChange={(e) => setField('scriptureRef', e.target.value)}
                  placeholder="e.g. Joel 2:25"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-series">Series</Label>
                <Select value={form.seriesId} onValueChange={(v) => setField('seriesId', v)}>
                  <SelectTrigger id="s-series" className="w-full min-h-11">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_SERIES}>None</SelectItem>
                    {series.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-description">Description</Label>
              <Textarea
                id="s-description"
                rows={4}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="A short summary of the message…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-video">Video link</Label>
              <Input
                id="s-video"
                className="min-h-11"
                value={form.videoUrl}
                onChange={(e) => setField('videoUrl', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                inputMode="url"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-audio">Audio link</Label>
                <Input
                  id="s-audio"
                  className="min-h-11"
                  value={form.audioUrl}
                  onChange={(e) => setField('audioUrl', e.target.value)}
                  placeholder="https://…/sermon.mp3"
                  inputMode="url"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-notes">Notes link</Label>
                <Input
                  id="s-notes"
                  className="min-h-11"
                  value={form.notesUrl}
                  onChange={(e) => setField('notesUrl', e.target.value)}
                  placeholder="https://…/notes.pdf"
                  inputMode="url"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-image">Image</Label>
              <div className="flex gap-2">
                <Input
                  id="s-image"
                  className="min-h-11 flex-1"
                  value={form.imageUrl}
                  onChange={(e) => setField('imageUrl', e.target.value)}
                  placeholder="https://… or pick from the media library"
                  inputMode="url"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 shrink-0"
                  onClick={() => setPickerTarget('sermon')}
                >
                  <ImagePlus className="size-4" aria-hidden /> Choose
                </Button>
              </div>
            </div>
            {isAuthor ? (
              <p className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                Submits as draft for editor review.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="s-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                  <SelectTrigger id="s-status" className="w-full min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="min-h-11" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              {editing ? 'Save changes' : 'Save sermon'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Series dialog ------------------------------------------------- */}
      <Dialog open={seriesDialogOpen} onOpenChange={setSeriesDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSeries ? 'Edit series' : 'New series'}</DialogTitle>
            <DialogDescription>A themed collection of sermons, e.g. a book study.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="se-title">Title *</Label>
              <Input
                id="se-title"
                className="min-h-11"
                value={seriesForm.title}
                onChange={(e) => setSeriesField('title', e.target.value)}
                placeholder="e.g. Romans: The Gospel of God"
                autoFocus={!editingSeries}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="se-description">Description</Label>
              <Textarea
                id="se-description"
                rows={3}
                value={seriesForm.description}
                onChange={(e) => setSeriesField('description', e.target.value)}
                placeholder="What is this series about?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="se-image">Image</Label>
              <div className="flex gap-2">
                <Input
                  id="se-image"
                  className="min-h-11 flex-1"
                  value={seriesForm.imageUrl}
                  onChange={(e) => setSeriesField('imageUrl', e.target.value)}
                  placeholder="https://… or pick from the media library"
                  inputMode="url"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 shrink-0"
                  onClick={() => setPickerTarget('series')}
                >
                  <ImagePlus className="size-4" aria-hidden /> Choose
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setSeriesDialogOpen(false)}
              disabled={savingSeries}
            >
              Cancel
            </Button>
            <Button className="min-h-11" onClick={saveSeries} disabled={savingSeries}>
              {savingSeries ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              {editingSeries ? 'Save changes' : 'Create series'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPicker
        open={pickerTarget !== null}
        slug={slug}
        onClose={() => setPickerTarget(null)}
        onSelect={(url) => {
          if (pickerTarget === 'sermon') setField('imageUrl', url)
          else if (pickerTarget === 'series') setSeriesField('imageUrl', url)
          setPickerTarget(null)
        }}
      />
    </div>
  )
}
