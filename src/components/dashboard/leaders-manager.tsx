'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
  Users,
  ImagePlus,
  Mail,
  Phone,
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

type LeaderRow = {
  id: string
  name: string
  title: string
  bio: string | null
  imageUrl: string | null
  email: string | null
  phone: string | null
  status: string
}

type LeaderForm = {
  name: string
  title: string
  bio: string
  imageUrl: string
  email: string
  phone: string
  status: string
}

const EMPTY_FORM: LeaderForm = {
  name: '',
  title: '',
  bio: '',
  imageUrl: '',
  email: '',
  phone: '',
  status: 'PUBLISHED',
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'PUBLISHED' ? 'default' : status === 'DRAFT' ? 'secondary' : 'outline'
  const label = status === 'PUBLISHED' ? 'Published' : status === 'DRAFT' ? 'Draft' : 'Archived'
  return <Badge variant={variant}>{label}</Badge>
}

export function LeadersManager({ slug, role }: { slug: string; role: ChurchRole }) {
  const [leaders, setLeaders] = useState<LeaderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LeaderRow | null>(null)
  const [form, setForm] = useState<LeaderForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const isAuthor = role === 'AUTHOR'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ leaders: LeaderRow[] }>(`/api/dashboard/${slug}/leaders`)
      setLeaders(res.leaders)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load the leadership team.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  function setField<K extends keyof LeaderForm>(key: K, value: LeaderForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(leader: LeaderRow) {
    setEditing(leader)
    setForm({
      name: leader.name,
      title: leader.title,
      bio: leader.bio ?? '',
      imageUrl: leader.imageUrl ?? '',
      email: leader.email ?? '',
      phone: leader.phone ?? '',
      status: leader.status,
    })
    setDialogOpen(true)
  }

  async function save() {
    if (form.name.trim().length < 2) {
      toast.error('Enter the name (at least 2 characters).')
      return
    }
    if (form.title.trim().length < 2) {
      toast.error('Add a role, e.g. Senior Pastor.')
      return
    }
    setSaving(true)
    // Authors cannot set the status — the server forces drafts anyway.
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      title: form.title.trim(),
      bio: form.bio,
      imageUrl: form.imageUrl.trim(),
      email: form.email.trim(),
      phone: form.phone,
    }
    if (!isAuthor) payload.status = form.status
    try {
      if (editing) {
        await apiFetch(`/api/dashboard/${slug}/leaders/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast.success('Leader updated.')
      } else {
        await apiFetch(`/api/dashboard/${slug}/leaders`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success(isAuthor ? 'Leader submitted as a draft for review.' : 'Leader added.')
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the leader.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(leader: LeaderRow) {
    if (!confirm(`Remove “${leader.name}” from the leadership page? This cannot be undone.`)) return
    try {
      await apiFetch(`/api/dashboard/${slug}/leaders/${leader.id}`, { method: 'DELETE' })
      toast.success('Leader removed.')
      load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not remove the leader.')
    }
  }

  const filtered = leaders.filter(
    (l) =>
      !query ||
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      l.title.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leadership</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Introduce your pastors, elders and team — names, roles and how to reach them.
          </p>
        </div>
        <Button className="min-h-11" onClick={openCreate}>
          <Plus className="size-4" aria-hidden /> New leader
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Search by name or role…"
          className="pl-9 min-h-11"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search leaders"
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
          <Users className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">{leaders.length === 0 ? 'No leaders yet' : 'No leaders match your search'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {leaders.length === 0
              ? 'Add the people who lead your church so visitors can meet them.'
              : 'Try a different search term.'}
          </p>
          {leaders.length === 0 ? (
            <Button className="mt-5 min-h-11" onClick={openCreate}>
              <Plus className="size-4" aria-hidden /> New leader
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((leader) => (
            <li key={leader.id} className="rounded-2xl border bg-background p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {leader.imageUrl ? (
                    <img
                      src={leader.imageUrl}
                      alt={leader.name}
                      className="size-10 rounded-xl object-cover shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary shrink-0" aria-hidden>
                      <Users className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{leader.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{leader.title}</p>
                    {leader.bio ? (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{leader.bio}</p>
                    ) : null}
                  </div>
                </div>
                <StatusBadge status={leader.status} />
              </div>

              {leader.email || leader.phone ? (
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {leader.email ? (
                    <p className="flex items-center gap-2">
                      <Mail className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{leader.email}</span>
                    </p>
                  ) : null}
                  {leader.phone ? (
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{leader.phone}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-auto pt-4 border-t flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  className="size-11"
                  onClick={() => openEdit(leader)}
                  aria-label={`Edit ${leader.name}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  className="size-11 text-destructive hover:text-destructive"
                  onClick={() => remove(leader)}
                  aria-label={`Delete ${leader.name}`}
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
            <DialogTitle>{editing ? 'Edit leader' : 'New leader'}</DialogTitle>
            <DialogDescription>
              Add the person behind the role — a short bio helps visitors connect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="l-name">Name *</Label>
                <Input
                  id="l-name"
                  className="min-h-11"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. Daniel Okoye"
                  autoFocus={!editing}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-title">Role *</Label>
                <Input
                  id="l-title"
                  className="min-h-11"
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="e.g. Senior Pastor"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="l-bio">Bio</Label>
              <Textarea
                id="l-bio"
                rows={4}
                value={form.bio}
                onChange={(e) => setField('bio', e.target.value)}
                placeholder="A short introduction — family, calling, favourite verse…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="l-image">Photo</Label>
              <div className="flex gap-2">
                <Input
                  id="l-image"
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="l-email">Email</Label>
                <Input
                  id="l-email"
                  type="email"
                  className="min-h-11"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="pastor@church.org"
                  inputMode="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-phone">Phone</Label>
                <Input
                  id="l-phone"
                  type="tel"
                  className="min-h-11"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+234 800 000 0000"
                />
              </div>
            </div>
            {isAuthor ? (
              <p className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                Submits as draft for editor review.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="l-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                  <SelectTrigger id="l-status" className="w-full min-h-11">
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
              {editing ? 'Save changes' : 'Add leader'}
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
