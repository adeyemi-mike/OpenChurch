'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Save,
  Rocket,
  Eye,
  Settings2,
  Loader2,
  Monitor,
  Tablet,
  Smartphone,
  CircleHelp,
  Image as ImageIcon,
  Columns2,
  Images,
  Clock,
  CalendarDays,
  BookOpen,
  HeartHandshake,
  Users,
  PlayCircle,
  Quote,
  MousePointerClick,
  Mail,
  HandCoins,
  Text,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SectionFieldsEditor } from '@/components/builder/section-editor'
import {
  SECTION_REGISTRY,
  createSection,
} from '@/lib/sections/registry'
import type { SectionInstance, SectionsList } from '@/lib/sections/types'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import { cn } from '@/lib/utils'
import type { ChurchRole } from '@/lib/permissions'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Image: ImageIcon,
  Columns2,
  Images,
  Clock,
  CalendarDays,
  BookOpen,
  HeartHandshake,
  Users,
  PlayCircle,
  Quote,
  MousePointerClick,
  Mail,
  HandCoins,
  CircleHelp,
  Text,
}

export type PageDto = {
  id: string
  title: string
  slug: string
  isHomePage: boolean
  status: string
  seoTitle: string | null
  seoDescription: string | null
}

export function PageBuilder({
  slug,
  page,
  initialSections,
  role,
}: {
  slug: string
  page: PageDto
  initialSections: SectionsList
  role: ChurchRole
}) {
  const [sections, setSections] = useState<SectionsList>(initialSections)
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.id ?? null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [status, setStatus] = useState(page.status)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [addOpen, setAddOpen] = useState(false)
  const [seoOpen, setSeoOpen] = useState(false)
  const [title, setTitle] = useState(page.title)
  const [pageSlug, setPageSlug] = useState(page.slug)
  const [seoTitle, setSeoTitle] = useState(page.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(page.seoDescription ?? '')
  const [previewKey, setPreviewKey] = useState(0)

  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'EDITOR'
  const selected = useMemo(() => sections.find((s) => s.id === selectedId) ?? null, [sections, selectedId])

  function mutateSections(next: SectionsList) {
    setSections(next)
    setDirty(true)
  }

  function updateConfig(id: string, key: string, value: unknown) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? ({ ...s, [key]: value } as SectionInstance) : s))
    )
    setDirty(true)
  }

  function move(id: string, dir: -1 | 1) {
    const index = sections.findIndex((s) => s.id === id)
    const target = index + dir
    if (index < 0 || target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    mutateSections(next)
  }

  async function saveDraft(): Promise<boolean> {
    setSaving(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sections: JSON.stringify(sections),
          ...(canManage ? { title, slug: pageSlug, seoTitle, seoDescription } : {}),
        }),
      })
      setDirty(false)
      toast.success('Draft saved')
      return true
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the draft.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function publishPage() {
    if (dirty && !(await saveDraft())) return
    setPublishing(true)
    try {
      const res = await apiFetch<{ status: string }>(`/api/dashboard/${slug}/pages/${page.id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ action: 'publish' }),
      })
      setStatus(res.status)
      toast.success('Page published — it is live on your website.')
      setPreviewKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not publish the page.')
    } finally {
      setPublishing(false)
    }
  }

  async function togglePreview() {
    if (mode === 'edit' && dirty) {
      const okSave = await saveDraft()
      if (!okSave) return
    }
    setPreviewKey((k) => k + 1)
    setMode((m) => (m === 'edit' ? 'preview' : 'edit'))
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8">
      {/* Top bar */}
      <div className="border-b bg-background sticky top-14 lg:top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/console/${slug}/pages`}>
              <ArrowLeft className="size-4" aria-hidden /> Pages
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            {canManage ? (
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setDirty(true)
                }}
                aria-label="Page title"
                className="w-full bg-transparent font-semibold text-lg outline-none focus:underline rounded px-1 -ml-1"
              />
            ) : (
              <p className="font-semibold text-lg truncate">{title}</p>
            )}
            <p className="text-xs text-muted-foreground -mt-0.5">
              {status === 'PUBLISHED' ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> Published
                  {dirty ? <span className="text-amber-600">· unsaved draft changes</span> : null}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-500" aria-hidden /> Draft
                  {status === 'ARCHIVED' ? ' (archived)' : ''}
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSeoOpen(true)} disabled={!canManage}>
            <Settings2 className="size-4" aria-hidden /> <span className="hidden sm:inline">Page settings</span>
          </Button>
          <Button variant="outline" size="sm" onClick={togglePreview}>
            <Eye className="size-4" aria-hidden /> {mode === 'edit' ? 'Preview' : 'Keep editing'}
          </Button>
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            <span className="hidden sm:inline">{dirty ? 'Save draft' : 'Saved'}</span>
          </Button>
          {canManage ? (
            <Button size="sm" onClick={publishPage} disabled={publishing}>
              {publishing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
              <span className="hidden sm:inline">{status === 'PUBLISHED' ? 'Update live' : 'Publish'}</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {mode === 'edit' ? (
          <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
            {/* Section list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Sections</p>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus className="size-4" aria-hidden /> Add
                </Button>
              </div>
              {sections.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No sections yet — add your first one.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sections.map((section, index) => {
                    const meta = SECTION_REGISTRY[section.type]
                    const Icon = ICONS[meta.icon] ?? Text
                    return (
                      <li key={section.id}>
                        <div
                          className={cn(
                            'rounded-xl border bg-background p-3 transition-colors',
                            selectedId === section.id && 'border-primary ring-1 ring-ring'
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              className="flex flex-1 items-center gap-2.5 text-left min-w-0"
                              onClick={() => setSelectedId(section.id)}
                              aria-current={selectedId === section.id}
                            >
                              <span
                                className={cn(
                                  'grid place-items-center size-8 rounded-lg shrink-0',
                                  section.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground/50'
                                )}
                                aria-hidden
                              >
                                <Icon className="size-4" />
                              </span>
                              <span className="min-w-0">
                                <span className={cn('block text-sm font-medium truncate', !section.enabled && 'text-muted-foreground line-through')}>
                                  {section.title || meta.name}
                                </span>
                                <span className="block text-[11px] text-muted-foreground">{meta.name}</span>
                              </span>
                            </button>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                                aria-label="Move section up"
                                disabled={index === 0}
                                onClick={() => move(section.id, -1)}
                              >
                                <ChevronUp className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                                aria-label="Move section down"
                                disabled={index === sections.length - 1}
                                onClick={() => move(section.id, 1)}
                              >
                                <ChevronDown className="size-3.5" aria-hidden />
                              </button>
                            </div>
                            <Switch
                              checked={section.enabled}
                              onCheckedChange={(v) => updateConfig(section.id, 'enabled', v)}
                              aria-label={`${section.enabled ? 'Hide' : 'Show'} section ${meta.name}`}
                            />
                            <button
                              type="button"
                              className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              aria-label={`Delete section ${meta.name}`}
                              onClick={() => {
                                if (confirm('Remove this section? It will disappear from the page when you save.')) {
                                  mutateSections(sections.filter((s) => s.id !== section.id))
                                  if (selectedId === section.id) setSelectedId(null)
                                }
                              }}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Editor panel */}
            <div className="rounded-2xl border bg-background min-h-[400px]">
              {selected ? (
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="font-semibold">{SECTION_REGISTRY[selected.type].name}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {SECTION_REGISTRY[selected.type].description}
                      </p>
                    </div>
                    {SECTION_REGISTRY[selected.type].dynamic ? (
                      <Badge variant="secondary">Live data</Badge>
                    ) : null}
                  </div>
                  <SectionFieldsEditor
                    fields={SECTION_REGISTRY[selected.type].fields()}
                    values={selected as unknown as Record<string, unknown>}
                    onChange={(key, value) => updateConfig(selected.id, key, value)}
                    slug={slug}
                  />
                </div>
              ) : (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Select a section on the left to edit it, or add a new one.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Preview mode */
          <div>
            <div className="flex items-center justify-center gap-1 mb-4 rounded-xl border bg-background p-1 w-fit mx-auto">
              {(
                [
                  { key: 'desktop', icon: Monitor, label: 'Desktop' },
                  { key: 'tablet', icon: Tablet, label: 'Tablet' },
                  { key: 'mobile', icon: Smartphone, label: 'Mobile' },
                ] as const
              ).map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDevice(d.key)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                    device === d.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                  aria-pressed={device === d.key}
                >
                  <d.icon className="size-4" aria-hidden /> {d.label}
                </button>
              ))}
            </div>
            <div className="mx-auto transition-all" style={{ maxWidth: device === 'desktop' ? '100%' : device === 'tablet' ? '768px' : '390px' }}>
              <div className="overflow-hidden rounded-2xl border shadow-lg">
                <iframe
                  key={previewKey}
                  src={`/church/${slug}/preview?pageId=${page.id}`}
                  title="Page preview"
                  className="w-full h-[75vh] bg-white"
                />
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3">
              This preview shows your saved draft exactly as it will appear — including your theme,
              colours and typography.
            </p>
          </div>
        )}
      </div>

      {/* Add section dialog */}
      <AddSectionDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(type) => {
          const section = createSection(type)
          mutateSections([...sections, section])
          setSelectedId(section.id)
          setAddOpen(false)
        }}
      />

      {/* Page settings dialog */}
      <Dialog open={seoOpen} onOpenChange={setSeoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Page settings</DialogTitle>
            <DialogDescription>
              The path and search-engine details for this page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ps-slug">Path</Label>
              {page.isHomePage ? (
                <p className="text-sm text-muted-foreground rounded-lg bg-muted px-3 py-2.5">
                  This is your homepage — it lives at <code>/</code>.
                </p>
              ) : (
                <>
                  <div className="flex items-center rounded-md border bg-background">
                    <span className="pl-3 pr-1 text-sm text-muted-foreground select-none">/church/{slug}/</span>
                    <Input
                      id="ps-slug"
                      value={pageSlug}
                      onChange={(e) => {
                        setPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, ''))
                        setDirty(true)
                      }}
                      className="border-0 focus-visible:ring-0"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Lowercase letters, numbers and dashes.</p>
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-title">SEO title</Label>
              <Input
                id="ps-title"
                value={seoTitle}
                onChange={(e) => {
                  setSeoTitle(e.target.value)
                  setDirty(true)
                }}
                placeholder="Shown in search results"
                maxLength={70}
              />
              <p className="text-xs text-muted-foreground">{seoTitle.length}/70 characters</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-desc">Meta description</Label>
              <Textarea
                id="ps-desc"
                value={seoDescription}
                onChange={(e) => {
                  setSeoDescription(e.target.value)
                  setDirty(true)
                }}
                placeholder="A short summary shown under the title in search results"
                maxLength={200}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{seoDescription.length}/200 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSeoOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddSectionDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (type: SectionInstance['type']) => void
}) {
  const categories = [
    { key: 'structure', label: 'Page structure' },
    { key: 'content', label: 'Content' },
    { key: 'dynamic', label: 'Live church data' },
    { key: 'action', label: 'Calls to action' },
  ] as const

  return (
    <Dialog open={open} onOpenChange={setOpen => (setOpen ? undefined : onClose())}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a section</DialogTitle>
          <DialogDescription>Sections stack vertically to build your page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {categories.map((cat) => {
            const entries = Object.values(SECTION_REGISTRY).filter((m) => m.category === cat.key)
            if (!entries.length) return null
            return (
              <div key={cat.key}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {cat.label}
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {entries.map((meta) => {
                    const Icon = ICONS[meta.icon] ?? Text
                    return (
                      <button
                        key={meta.type}
                        type="button"
                        onClick={() => onAdd(meta.type)}
                        className="flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors hover:border-primary/60 hover:bg-primary/[0.03]"
                      >
                        <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0" aria-hidden>
                          <Icon className="size-4.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{meta.name}</span>
                          <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{meta.description}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
