'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
  CalendarDays,
  ImagePlus,
  MapPin,
  Ticket,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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

type EventRow = {
  id: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string | null
  locationText: string | null
  imageUrl: string | null
  registrationEnabled: boolean
  registrationUrl: string | null
  status: string
}

type EventForm = {
  title: string
  startsAt: string
  endsAt: string
  locationText: string
  description: string
  imageUrl: string
  registrationEnabled: boolean
  registrationUrl: string
  status: string
}

const EMPTY_FORM: EventForm = {
  title: '',
  startsAt: '',
  endsAt: '',
  locationText: '',
  description: '',
  imageUrl: '',
  registrationEnabled: false,
  registrationUrl: '',
  status: 'PUBLISHED',
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'PUBLISHED' ? 'default' : status === 'DRAFT' ? 'secondary' : 'outline'
  const label = status === 'PUBLISHED' ? 'Published' : status === 'DRAFT' ? 'Draft' : 'Archived'
  return <Badge variant={variant}>{label}</Badge>
}

/** ISO string → value accepted by <input type="datetime-local">. */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return ''
  const datePart = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timePart = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (!endsAt) return `${datePart} · ${timePart}`
  const end = new Date(endsAt)
  const sameDay = end.toDateString() === start.toDateString()
  const endPart = sameDay
    ? end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : end.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
  return `${datePart} · ${timePart} – ${endPart}`
}

export function EventsManager({ slug, role }: { slug: string; role: ChurchRole }) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [form, setForm] = useState<EventForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const isAuthor = role === 'AUTHOR'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ events: EventRow[] }>(`/api/dashboard/${slug}/events`)
      setEvents(res.events)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load events.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  function setField<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(event: EventRow) {
    setEditing(event)
    setForm({
      title: event.title,
      startsAt: toDatetimeLocalValue(event.startsAt),
      endsAt: event.endsAt ? toDatetimeLocalValue(event.endsAt) : '',
      locationText: event.locationText ?? '',
      description: event.description ?? '',
      imageUrl: event.imageUrl ?? '',
      registrationEnabled: event.registrationEnabled,
      registrationUrl: event.registrationUrl ?? '',
      status: event.status,
    })
    setDialogOpen(true)
  }

  async function save() {
    if (form.title.trim().length < 2) {
      toast.error('Give the event a title (at least 2 characters).')
      return
    }
    if (!form.startsAt) {
      toast.error('Pick a start date and time.')
      return
    }
    if (form.endsAt && new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()) {
      toast.error('The end time must be after the start time.')
      return
    }
    setSaving(true)
    // Authors cannot set the status — the server forces drafts anyway.
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      locationText: form.locationText,
      description: form.description,
      imageUrl: form.imageUrl.trim(),
      registrationEnabled: form.registrationEnabled,
      registrationUrl: form.registrationEnabled ? form.registrationUrl.trim() : '',
    }
    if (!isAuthor) payload.status = form.status
    try {
      if (editing) {
        await apiFetch(`/api/dashboard/${slug}/events/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast.success('Event updated.')
      } else {
        await apiFetch(`/api/dashboard/${slug}/events`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success(isAuthor ? 'Event submitted as a draft for review.' : 'Event created.')
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the event.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(event: EventRow) {
    if (!confirm(`Delete “${event.title}”? This cannot be undone.`)) return
    try {
      await apiFetch(`/api/dashboard/${slug}/events/${event.id}`, { method: 'DELETE' })
      toast.success('Event deleted.')
      load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the event.')
    }
  }

  const filtered = events.filter(
    (e) => !query || e.title.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Services, conferences and gatherings — upcoming and past, newest first.
          </p>
        </div>
        <Button className="min-h-11" onClick={openCreate}>
          <Plus className="size-4" aria-hidden /> New event
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Search events…"
          className="pl-9 min-h-11"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search events"
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
          <CalendarDays className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">{events.length === 0 ? 'No events yet' : 'No events match your search'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {events.length === 0
              ? 'Share what is happening at your church — add your first event.'
              : 'Try a different search term.'}
          </p>
          {events.length === 0 ? (
            <Button className="mt-5 min-h-11" onClick={openCreate}>
              <Plus className="size-4" aria-hidden /> New event
            </Button>
          ) : null}
        </div>
      ) : (
        // grid-cols-1 (minmax(0,1fr)) keeps nowrap titles from inflating the
        // auto track — the list must never overflow a 360px viewport.
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((event) => (
            <li key={event.id} className="rounded-2xl border bg-background p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary shrink-0" aria-hidden>
                    <CalendarDays className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{event.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatWhen(event.startsAt, event.endsAt)}</p>
                  </div>
                </div>
                <StatusBadge status={event.status} />
              </div>

              {event.description ? (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{event.description}</p>
              ) : null}

              {event.locationText || event.registrationEnabled ? (
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {event.locationText ? (
                    <p className="flex items-center gap-2">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{event.locationText}</span>
                    </p>
                  ) : null}
                  {event.registrationEnabled ? (
                    <p className="flex items-center gap-2">
                      <Ticket className="size-3.5 shrink-0" aria-hidden />
                      <span>Registration open</span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-auto pt-4 border-t flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  className="size-11"
                  onClick={() => openEdit(event)}
                  aria-label={`Edit ${event.title}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  className="size-11 text-destructive hover:text-destructive"
                  onClick={() => remove(event)}
                  aria-label={`Delete ${event.title}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit event' : 'New event'}</DialogTitle>
            <DialogDescription>
              When and where it happens, plus an optional link for registrations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="e-title">Title *</Label>
              <Input
                id="e-title"
                className="min-h-11"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="e.g. Youth Camp 2025"
                autoFocus={!editing}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="e-starts">Starts *</Label>
                <Input
                  id="e-starts"
                  type="datetime-local"
                  className="min-h-11"
                  value={form.startsAt}
                  onChange={(e) => setField('startsAt', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-ends">Ends (optional)</Label>
                <Input
                  id="e-ends"
                  type="datetime-local"
                  className="min-h-11"
                  value={form.endsAt}
                  onChange={(e) => setField('endsAt', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-location">Location</Label>
              <Input
                id="e-location"
                className="min-h-11"
                value={form.locationText}
                onChange={(e) => setField('locationText', e.target.value)}
                placeholder="e.g. Main auditorium"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-description">Description</Label>
              <Textarea
                id="e-description"
                rows={4}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="What should people expect? What should they bring?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-image">Image</Label>
              <div className="flex gap-2">
                <Input
                  id="e-image"
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
            <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
              <div>
                <Label htmlFor="e-registration" className="text-sm font-medium">
                  Enable registration
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Link people to an external sign-up page.
                </p>
              </div>
              <Switch
                id="e-registration"
                checked={form.registrationEnabled}
                onCheckedChange={(v) => setField('registrationEnabled', v)}
              />
            </div>
            {form.registrationEnabled ? (
              <div className="space-y-1.5">
                <Label htmlFor="e-registration-url">Registration link</Label>
                <Input
                  id="e-registration-url"
                  className="min-h-11"
                  value={form.registrationUrl}
                  onChange={(e) => setField('registrationUrl', e.target.value)}
                  placeholder="https://your-registration-provider.example.org/event-signup"
                  inputMode="url"
                />
              </div>
            ) : null}
            {isAuthor ? (
              <p className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                Submits as draft for editor review.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="e-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                  <SelectTrigger id="e-status" className="w-full min-h-11">
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
              {editing ? 'Save changes' : 'Create event'}
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
