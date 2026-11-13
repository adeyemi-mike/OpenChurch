'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarCheck,
  EyeOff,
  HeartHandshake,
  Inbox,
  Loader2,
  Lock,
  Mail,
  MessagesSquare,
  Phone,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

type SubmissionRow = {
  id: string
  type: string
  name: string
  email: string | null
  phone: string | null
  subject: string | null
  message: string
  isSensitive: boolean
  status: string
  createdAt: string
  updatedAt: string
}

type FormRow = {
  id: string
  type: string
  title: string
  description: string
  isActive: boolean
  successMessage: string
  updatedAt: string
}

type FormDraft = { title: string; description: string; successMessage: string; isActive: boolean }

const PAGE_SIZE = 20

const STATUS_LABEL: Record<string, string> = {
  NEW: 'New',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  ARCHIVED: 'Archived',
}

const TYPE_LABEL: Record<string, string> = {
  CONTACT: 'Contact',
  PRAYER: 'Prayer',
  COUNSELLING: 'Counselling',
  TESTIMONY: 'Testimony',
  FOLLOWUP: 'Follow-up',
  REGISTRATION: 'Registration',
}

const TYPE_ICONS: Record<string, typeof Mail> = {
  CONTACT: Mail,
  PRAYER: HeartHandshake,
  COUNSELLING: MessagesSquare,
  TESTIMONY: Sparkles,
  FOLLOWUP: UserPlus,
  REGISTRATION: CalendarCheck,
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All types' },
  { value: 'CONTACT', label: 'Contact' },
  { value: 'PRAYER', label: 'Prayer' },
  { value: 'COUNSELLING', label: 'Counselling' },
  { value: 'TESTIMONY', label: 'Testimony' },
  { value: 'FOLLOWUP', label: 'Follow-up' },
]

function statusBadge(status: string) {
  if (status === 'NEW') return <Badge>{STATUS_LABEL[status] ?? status}</Badge>
  if (status === 'IN_PROGRESS') return <Badge variant="secondary">{STATUS_LABEL[status] ?? status}</Badge>
  if (status === 'RESOLVED') return <Badge variant="outline">{STATUS_LABEL[status] ?? status}</Badge>
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

export function EnquiriesManager({ slug, role }: { slug: string; role: ChurchRole }) {
  const canViewEnquiries = can(role, 'enquiries:view')
  const canManageForms = can(role, 'forms:manage')

  // --- Enquiries inbox state ------------------------------------------------
  const [items, setItems] = useState<SubmissionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canViewSensitive, setCanViewSensitive] = useState(true)

  const [status, setStatus] = useState('ALL')
  const [type, setType] = useState('ALL')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [selected, setSelected] = useState<SubmissionRow | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // --- Forms config state ---------------------------------------------------
  const [forms, setForms] = useState<FormRow[]>([])
  const [formsLoading, setFormsLoading] = useState(true)
  const [formsError, setFormsError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, FormDraft>>({})
  const [savingForm, setSavingForm] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status !== 'ALL') params.set('status', status)
      if (type !== 'ALL') params.set('type', type)
      if (debouncedQuery) params.set('q', debouncedQuery)
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      const res = await apiFetch<{
        items: SubmissionRow[]
        total: number
        page: number
        pageSize: number
        canViewSensitive: boolean
      }>(`/api/dashboard/${slug}/submissions?${params.toString()}`)
      setItems(res.items)
      setTotal(res.total)
      setCanViewSensitive(res.canViewSensitive)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load enquiries.')
    } finally {
      setLoading(false)
    }
  }, [slug, status, type, debouncedQuery, page])

  useEffect(() => {
    if (canViewEnquiries) load()
  }, [canViewEnquiries, load])

  // Forms configuration (owners only)
  useEffect(() => {
    if (!canManageForms) return
    let cancelled = false
    setFormsLoading(true)
    setFormsError(null)
    apiFetch<{ forms: FormRow[] }>(`/api/dashboard/${slug}/forms`)
      .then((res) => {
        if (cancelled) return
        setForms(res.forms)
      })
      .catch((err) => {
        if (cancelled) return
        setFormsError(err instanceof ApiClientError ? err.message : 'Could not load form settings.')
      })
      .finally(() => {
        if (!cancelled) setFormsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, canManageForms])

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        forms.map((f) => [
          f.type,
          { title: f.title, description: f.description, successMessage: f.successMessage, isActive: f.isActive },
        ])
      )
    )
  }, [forms])

  async function updateStatus(next: string) {
    if (!selected) return
    setUpdating(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/submissions/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      toast.success(`Marked as ${STATUS_LABEL[next]?.toLowerCase() ?? next}.`)
      setItems((prev) => prev.map((it) => (it.id === selected.id ? { ...it, status: next } : it)))
      setSelected({ ...selected, status: next })
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update the status.')
    } finally {
      setUpdating(false)
    }
  }

  async function deleteSubmission() {
    if (!selected) return
    if (!confirm('Delete this enquiry? This cannot be undone.')) return
    setDeleting(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/submissions/${selected.id}`, { method: 'DELETE' })
      toast.success('Enquiry deleted.')
      setSelected(null)
      if (items.length <= 1 && page > 1) setPage((p) => p - 1)
      else load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the enquiry.')
      setDeleting(false)
    }
  }

  function patchDraft(formType: string, patch: Partial<FormDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [formType]: { ...prev[formType], ...patch },
    }))
  }

  async function saveForm(formType: string) {
    const draft = drafts[formType]
    if (!draft) return
    if (draft.title.trim().length < 2) {
      toast.error('Give the form a title (at least 2 characters).')
      return
    }
    setSavingForm(formType)
    try {
      const saved = await apiFetch<FormRow>(`/api/dashboard/${slug}/forms`, {
        method: 'PUT',
        body: JSON.stringify({
          type: formType,
          title: draft.title.trim(),
          description: draft.description.trim(),
          isActive: draft.isActive,
          successMessage: draft.successMessage.trim(),
        }),
      })
      setForms((prev) => prev.map((f) => (f.type === formType ? saved : f)))
      toast.success(`${TYPE_LABEL[formType] ?? formType} form saved.`)
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the form.')
    } finally {
      setSavingForm(null)
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)
  const hasFilters = status !== 'ALL' || type !== 'ALL' || Boolean(debouncedQuery)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forms &amp; Enquiries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Messages submitted through your website contact, prayer and other forms.
        </p>
      </div>

      {!canViewEnquiries ? (
        <div className="rounded-2xl border border-dashed px-4 py-16 text-center">
          <Lock className="mx-auto size-8 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">You do not have access to enquiries</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Editors and above can view messages submitted through the website forms.
          </p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="space-y-3">
            <Tabs
              value={status}
              onValueChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
            >
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto sm:w-fit">
                {STATUS_OPTIONS.map((o) => (
                  <TabsTrigger key={o.value} value={o.value} className="h-11 flex-none px-3 sm:px-4">
                    {o.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-xs">
                <Search
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  className="h-11 pl-9"
                  placeholder="Search name, email or subject…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Search enquiries"
                />
              </div>
              <Select
                value={type}
                onValueChange={(v) => {
                  setType(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-11 w-full sm:w-44" aria-label="Filter by type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => load()}
                disabled={loading}
                aria-label="Refresh enquiries"
       <div className="space-y-2.5 rounded-xl border p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">From</span>
                  <span className="truncate font-medium">
                    {selected.isSensitive ? 'Sensitive request' : selected.name}
                  </span>
                </div>
                {selected.email ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Email</span>
                    <a
                      href={`mailto:${selected.email}`}
                      className="inline-flex min-w-0 items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      <Mail className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{selected.email}</span>
                    </a>
                  </div>
                ) : null}
                {selected.phone ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Phone</span>
                    <a
                      href={`tel:${selected.phone}`}
                      className="inline-flex min-w-0 items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      <Phone className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{selected.phone}</span>
                    </a>
                  </div>
                ) : null}
                {!selected.email && !selected.phone ? (
                  <p className="text-muted-foreground">No contact details provided.</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1.5 sm:w-52">
                  <Label htmlFor="submission-status">Status</Label>
                  <Select
                    value={selected.status}
                    onValueChange={(v) => updateStatus(v)}
                    disabled={updating}
                  >
                    <SelectTrigger id="submission-status" className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">New</SelectItem>
                      <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={deleteSubmission}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-4" aria-hidden />
                  )}
                  Delete
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
              >
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                Refresh
              </Button>
            </div>
          </div>

          {/* Sensitive-data notice for editors */}
          {canViewSensitive === false ? (
            <p className="flex items-start gap-2.5 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
              You are viewing general enquiries only. Prayer and counselling requests are visible
              to owners and administrators.
            </p>
          ) : null}

          {/* Inbox list */}
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
              <Inbox className="mx-auto size-8 text-muted-foreground/50" aria-hidden />
              <p className="mt-3 font-medium">
                {hasFilters ? 'No enquiries match your filters' : 'No enquiries yet'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFilters
                  ? 'Try a different status, type or search term.'
                  : 'Messages from your website contact, prayer and other forms will appear here.'}
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {items.map((s) => {
                  const TypeIcon = TYPE_ICONS[s.type] ?? Mail
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(s)}
                        className="flex w-full flex-col gap-3 rounded-xl border bg-background p-4 text-left shadow-xs transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:justify-between"
                        aria-label={`Open enquiry from ${s.isSensitive ? 'a confidential request' : s.name}`}
                      >
                        <span className="flex min-w-0 items-start gap-3">
                          <span
                            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
                            aria-hidden
                          >
                            <TypeIcon className="size-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">
                              {s.subject?.trim() || `${TYPE_LABEL[s.type] ?? s.type} enquiry`}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                              {s.isSensitive ? (
                                <>
                                  <Lock className="size-3 shrink-0" aria-hidden /> Sensitive request
                                </>
                              ) : (
                                s.name
                              )}
                            </span>
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Badge variant="outline">{TYPE_LABEL[s.type] ?? s.type}</Badge>
                          {statusBadge(s.status)}
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.createdAt).toLocaleString()}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
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
        </>
      )}

      {/* Forms configuration — owners only */}
      {canManageForms ? (
        <section className="space-y-4" aria-labelledby="form-settings-title">
          <div>
            <h2 id="form-settings-title" className="text-lg font-semibold">
              Form settings
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose which forms accept submissions and edit the wording people see.
            </p>
          </div>

          <p className="flex items-start gap-2.5 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            Prayer and counselling submissions are always access-restricted and never shown on the
            public website.
          </p>

          {formsError ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {formsError}
            </p>
          ) : formsLoading ? (
            <div className="grid place-items-center rounded-2xl border py-16 text-muted-foreground" role="status">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {forms.map((f) => {
                const draft = drafts[f.type]
                if (!draft) return null
                const dirty =
                  JSON.stringify(draft) !==
                  JSON.stringify({
                    title: f.title,
                    description: f.description,
                    successMessage: f.successMessage,
                    isActive: f.isActive,
                  })
                return (
                  <Card key={f.type} className="gap-4 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{TYPE_LABEL[f.type] ?? f.type}</p>
                      <span className="flex items-center gap-2">
                        <Label
                          htmlFor={`form-active-${f.type}`}
                          className="text-sm text-muted-foreground"
                        >
                          Accepting submissions
                        </Label>
                        <Switch
                          id={`form-active-${f.type}`}
                          checked={draft.isActive}
                          onCheckedChange={(v) => patchDraft(f.type, { isActive: v })}
                        />
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`form-title-${f.type}`}>Title</Label>
                      <Input
                        id={`form-title-${f.type}`}
                        value={draft.title}
                        onChange={(e) => patchDraft(f.type, { title: e.target.value })}
                        placeholder="Form title"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`form-desc-${f.type}`}>Description</Label>
                      <Textarea
                        id={`form-desc-${f.type}`}
                        value={draft.description}
                        onChange={(e) => patchDraft(f.type, { description: e.target.value })}
                        placeholder="Shown above the form fields"
                        className="min-h-16"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`form-success-${f.type}`}>Success message</Label>
                      <Input
                        id={`form-success-${f.type}`}
                        value={draft.successMessage}
                        onChange={(e) => patchDraft(f.type, { successMessage: e.target.value })}
                        placeholder="Thank you message after submitting"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t pt-3">
                      {dirty ? (
                        <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                          Unsaved changes
                        </span>
                      ) : null}
                      <Button
                        onClick={() => saveForm(f.type)}
                        disabled={!dirty || savingForm === f.type}
                      >
                        {savingForm === f.type ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Save className="size-4" aria-hidden />
                        )}
                        Save
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* Enquiry detail dialog */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">
                  {selected.subject?.trim() || `${TYPE_LABEL[selected.type] ?? selected.type} enquiry`}
                </DialogTitle>
                <DialogDescription>
                  {selected.isSensitive ? 'Confidential request' : selected.name} ·{' '}
                  {new Date(selected.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              {selected.isSensitive ? (
                <p className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                  <Lock className="size-3.5 shrink-0" aria-hidden />
                  Kept confidential — pastoral access only
                </p>
              ) : null}

              <div className="max-h-64 overflow-y-auto rounded-xl bg-muted/60 p-4 text-sm whitespace-pre-wrap [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                {selected.message}
              </div>

       