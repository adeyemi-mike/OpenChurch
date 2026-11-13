'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
  HeartHandshake,
  ImagePlus,
  Clock,
  MapPin,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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

type MinistryRow = {
  id: string
  name: string
  description: string | null
  leaderName: string | null
  meetingTime: string | null
  location: string | null
  imageUrl: string | null
  status: string
}

type MinistryForm = {
  name: string
  description: string
  leaderName: string
  meetingTime: string
  location: string
  imageUrl: string
  status: string
}

const EMPTY_FORM: MinistryForm = {
  name: '',
  description: '',
  leaderName: '',
  meetingTime: '',
  location: '',
  imageUrl: '',
  status: 'PUBLISHED',
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'PUBLISHED' ? 'default' : status === 'DRAFT' ? 'secondary' : 'outline'
  const label = status === 'PUBLISHED' ? 'Published' : status === 'DRAFT' ? 'Draft' : 'Archived'
  return <Badge variant={variant}>{label}</Badge>
}

export function MinistriesManager({ slug, role }: { slug: string; role: ChurchRole }) {
  const [ministries, setMinistries] = useState<MinistryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MinistryRow | null>(null)
  const [form, setForm] = useState<MinistryForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const isAuthor = role === 'AUTHOR'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ ministries: MinistryRow[] }>(`/api/dashboard/${slug}/ministries`)
      setMinistries(res.ministries)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load ministries.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  function setField<K extends keyof MinistryForm>(key: K, value: MinistryForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(ministry: MinistryRow) {
    setEditing(ministry)
    setForm({
      name: ministry.name,
      description: ministry.description ?? '',
      leaderName: ministry.leaderName ?? '',
      meetingTime: ministry.meetingTime ?? '',
      location: ministry.location ?? '',
      imageUrl: ministry.imageUrl ?? '',
      status: ministry.status,
    })
    setDialogOpen(true)
  }

  async function save() {
    if (form.name.trim().length < 2) {
      toast.error('Give the ministry a name (at least 2 characters).')
      return
    }
    setSaving(true)
    // Authors cannot set the status — the server forces drafts anyway.
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description,
      leaderName: form.leaderName,
      meetingTime: form.meetingTime,
      location: form.location,
      imageUrl: form.imageUrl.trim(),
    }
    if (!isAuthor) payload.status = form.status
    try {
      if (editing) {
        await apiFetch(`/api/dashboard/${slug}/ministries/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast.success('Ministry updated.')
      } else {
        await apiFetch(`/api/dashboard/${slug}/ministries`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success(isAuthor ? 'Ministry submitted as a draft for review.' : 'Ministry created.')
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the ministry.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(ministry: MinistryRow) {
    if (!confirm(`Delete “${ministry.name}”? This cannot be undone.`)) return
    try {
      await apiFetch(`/api/dashboard/${slug}/ministries/${ministry.id}`, { method: 'DELETE' })
      toast.success('Ministry deleted.')
      load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the ministry.')
    }
  }

  const filtered = ministries.filter(
    (m) => !query || m.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ministries</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Showcase every ministry — who leads it, when and where it meets.
          </p>
        </div>
        <Button className="min-h-11" onClick={openCreate}>
          <Plus className="size-4" aria-hidden /> New ministry
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Search ministries…"
          className="pl-9 min-h-11"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search ministries"
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
          <HeartHandshake className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">{ministries.length === 0 ? 'No ministries yet' : 'No ministries match your search'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {ministries.length === 0
              ? 'Add your first ministry so people know how to get involved.'
              : 'Try a different search term.'}
          </p>
          {ministries.length === 0 ? (
            <Button className="mt-5 min-h-11" onClick={openCreate}>
              <Plus className="size-4" aria-hidden /> New ministry
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((ministry) => (
            <li key={ministry.id} className="rounded-2xl border bg-background p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary shrink-0" aria-hidden>
                    <HeartHandshake className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{ministry.name}</p>
                    {ministry.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{ministry.description}</p>
                    ) : null}
                  </div>
                </div>
                <StatusBadge status={ministry.status} />
              </div>

              {ministry.leaderName || ministry.meetingTime || ministry.location ? (
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {ministry.leaderName ? (
                    <p className="flex items-center gap-2">
                      <User className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">Led by {ministry.leaderName}</span>
                    </p>
                  ) : null}
                  {ministry.meetingTime ? (
                    <p className="flex items-center gap-2">
                      <Clock className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{ministry.meetingTime}</span>
                    </p>
                  ) : null}
                  {ministry.location ? (
                    <p className="flex items-center gap-2">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{ministry.location}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-auto pt-4 border-t flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  className="size-11"
                  onClick={() => openEdit(ministry)}
                  aria-label={`Edit ${ministry.name}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  className="size-11 text-destructive hover:text-destructive"
                  onClick={() => remove(ministry)}
                  aria-label={`Delete ${ministry.name}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit ministry' : 'New ministry'}</DialogTitle>
            <DialogDescription>
              Ministries appear on your public website — describe them so visitors know how to join in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Name *</Label>
              <Input
                id="m-name"
                className="min-h-11"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Youth Ministry"
                autoFocus={!editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-description">Description</Label>
              <Textarea
                id="m-description"
                rows={4}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="What does this ministry do? Who is it for?"
              />
              <p className="text-xs text-muted-foreground">Markdown is supported.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="m-leader">Leader</Label>
                <Input
                  id="m-leader"
                  className="min-h-11"
                  value={form.leaderName}
                  onChange={(e) => setField('leaderName', e.target.value)}
                  placeholder="e.g. Sarah Adeyemi"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-meeting">Meeting time</Label>
                <Input
                  id="m-meeting"
                  className="min-h-11"
                  value={form.meetingTime}
                  onChange={(e) => setField('meetingTime', e.target.value)}
                  placeholder="e.g. Saturdays, 4pm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-location">Location</Label>
              <Input
                id="m-location"
                className="min-h-11"
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                placeholder="e.g. Main hall, upstairs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-image">Image</Label>
              <div className="flex gap-2">
                <Input
                  id="m-image"
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
                  onClick={() => setPickerOpen(true)}
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
                <Label htmlFor="m-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                  <SelectTrigger id="m-status" className="w-full min-h-11">
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
              {editing ? 'Save changes' : 'Create ministry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPicker
        open={pickerOpen}
        slug={slug}
        onClose={() => setPickerOpen(false)}
        onSelect={(url) => setField('imageUrl', url)}
      />
    </div>
  )
}
