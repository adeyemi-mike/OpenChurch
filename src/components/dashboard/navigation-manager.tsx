'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronUp,
  Link2,
  Loader2,
  Lock,
  PanelBottom,
  PanelTop,
  Plus,
  Trash2,
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
import { apiFetch, ApiClientError } from '@/lib/client/api'
import { can, type ChurchRole } from '@/lib/permissions'

type NavItem = { label: string; href: string }
type PageRow = { id: string; title: string; slug: string; isHomePage: boolean; status: string }

type MenuLocation = 'HEADER' | 'FOOTER'

const MAX_ITEMS = 15

type MenuSectionProps = {
  slug: string
  location: MenuLocation
  title: string
  description: string
  items: NavItem[]
  savedItems: NavItem[]
  pages: PageRow[]
  onChange: (items: NavItem[]) => void
  onSaved: (items: NavItem[]) => void
}

function MenuSection({
  slug,
  location,
  title,
  description,
  items,
  savedItems,
  pages,
  onChange,
  onSaved,
}: MenuSectionProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newHref, setNewHref] = useState('')
  const [saving, setSaving] = useState(false)

  const dirty = JSON.stringify(items) !== JSON.stringify(savedItems)

  function updateField(index: number, field: 'label' | 'href', value: string) {
    onChange(items.map((it, i) => (i === index ? { ...it, [field]: value } : it)))
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    onChange(next)
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function addItem() {
    const label = newLabel.trim()
    const href = newHref.trim()
    if (!label) {
      toast.error('Give the link a label first.')
      return
    }
    if (!href) {
      toast.error('Add a link address, e.g. /about or https://example.org')
      return
    }
    if (items.length >= MAX_ITEMS) {
      toast.error(`Menus are limited to ${MAX_ITEMS} items.`)
      return
    }
    onChange([...items, { label, href }])
    setAddOpen(false)
    setNewLabel('')
    setNewHref('')
  }

  /** Quick-pick from the quick links — pre-fills the address (and label). */
  function pick(label: string, href: string) {
    setNewHref(href)
    if (!newLabel.trim()) setNewLabel(label)
  }

  async function save() {
    const cleaned = items.map((it) => ({ label: it.label.trim(), href: it.href.trim() }))
    if (cleaned.some((it) => !it.label || !it.href)) {
      toast.error('Every item needs both a label and a link.')
      return
    }
    if (cleaned.length > MAX_ITEMS) {
      toast.error(`Menus are limited to ${MAX_ITEMS} items.`)
      return
    }
    onChange(cleaned)
    setSaving(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/navigation`, {
        method: 'PUT',
        body: JSON.stringify({ location, items: cleaned }),
      })
      onSaved(cleaned)
      toast.success(`${title} saved.`)
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the menu.')
    } finally {
      setSaving(false)
    }
  }

  const quickPicks: { label: string; href: string }[] = [
    { label: 'Home', href: '/' },
    ...pages.map((p) => ({ label: p.title, href: p.isHomePage ? '/' : `/${p.slug}` })),
  ]

  return (
    <section className="rounded-2xl border bg-background p-4 sm:p-6" aria-labelledby={`menu-${location.toLowerCase()}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
            aria-hidden
          >
            {location === 'HEADER' ? <PanelTop className="size-5" /> : <PanelBottom className="size-5" />}
          </span>
          <div>
            <h2 id={`menu-${location.toLowerCase()}`} className="font-semibold">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
              Unsaved changes
            </span>
          ) : null}
          <Button
            variant="outline"
            className="h-11"
            onClick={() => setAddOpen(true)}
            disabled={items.length >= MAX_ITEMS}
          >
            <Plus className="size-4" aria-hidden /> Add item
          </Button>
          <Button className="h-11" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Save
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed px-4 py-10 text-center">
          <Link2 className="mx-auto size-7 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 text-sm font-medium">Menu is empty</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Your website currently links to your pages automatically. Adding items
            overrides the automatic menu.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item, i) => (
            <li
              key={`${item.label}-${i}`}
              className="flex flex-col gap-2 rounded-xl border bg-background p-3 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${item.label || `item ${i + 1}`} up`}
                >
                  <ChevronUp className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label={`Move ${item.label || `item ${i + 1}`} down`}
                >
                  <ChevronDown className="size-4" aria-hidden />
                </Button>
                <span
                  className="grid size-7 place-items-center rounded-md bg-muted font-mono text-xs text-muted-foreground"
                  aria-hidden
                >
                  {i + 1}
                </span>
              </div>
              <Input
                className="h-11 sm:w-48 sm:shrink-0"
                value={item.label}
                onChange={(e) => updateField(i, 'label', e.target.value)}
                placeholder="Label"
                aria-label={`Label for menu item ${i + 1}`}
              />
              <Input
                className="h-11 flex-1 font-mono text-xs"
                value={item.href}
                onChange={(e) => updateField(i, 'href', e.target.value)}
                placeholder="/about or https://…"
                aria-label={`Link for menu item ${i + 1}`}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-11 text-destructive hover:text-destructive"
                onClick={() => remove(i)}
                aria-label={`Remove ${item.label || `item ${i + 1}`}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a link</DialogTitle>
            <DialogDescription>
              Link to one of your pages or enter any external address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nav-label">Label</Label>
              <Input
                id="nav-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. About us"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nav-href">Link</Label>
              <Input
                id="nav-href"
                value={newHref}
                onChange={(e) => setNewHref(e.target.value)}
                placeholder="/about or https://example.org"
                className="font-mono text-xs"
              />
              <div className="pt-1">
                <p className="text-xs text-muted-foreground">Pick one of your pages:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {quickPicks.map((pickOption, pi) => (
                    <button
                      key={`${pickOption.href}-${pi}`}
                      type="button"
                      onClick={() => pick(pickOption.label, pickOption.href)}
                      className="min-h-9 rounded-full border bg-muted/40 px-3 py-1 text-xs transition-colors hover:bg-muted"
                    >
                      {pickOption.label}
                      <span className="ml-1 font-mono text-muted-foreground">{pickOption.href}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addItem}>
              <Plus className="size-4" aria-hidden /> Add item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function NavigationManager({ slug, role }: { slug: string; role: ChurchRole }) {
  const canManage = can(role, 'content:manage')

  const [headerItems, setHeaderItems] = useState<NavItem[]>([])
  const [footerItems, setFooterItems] = useState<NavItem[]>([])
  const [headerSaved, setHeaderSaved] = useState<NavItem[]>([])
  const [footerSaved, setFooterSaved] = useState<NavItem[]>([])
  const [pages, setPages] = useState<PageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nav, pagesRes] = await Promise.all([
        apiFetch<{ header: NavItem[]; footer: NavItem[] }>(`/api/dashboard/${slug}/navigation`),
        apiFetch<{ pages: PageRow[] }>(`/api/dashboard/${slug}/pages`),
      ])
      setHeaderItems(nav.header)
      setFooterItems(nav.footer)
      setHeaderSaved(nav.header)
      setFooterSaved(nav.footer)
      setPages(pagesRes.pages)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load navigation.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (canManage) load()
  }, [canManage, load])

  if (!canManage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Navigation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which links appear in your website&apos;s header and footer menus.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed px-4 py-16 text-center">
          <Lock className="mx-auto size-8 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">You need editor permissions to change navigation</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask an owner, administrator or editor to update the menus for this website.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Navigation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which links appear in your website&apos;s header and footer menus.
        </p>
      </div>

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
      ) : (
        <div className="space-y-6">
          <MenuSection
            slug={slug}
            location="HEADER"
            title="Header menu"
            description="Links shown at the top of every page."
            items={headerItems}
            savedItems={headerSaved}
            pages={pages}
            onChange={setHeaderItems}
            onSaved={setHeaderSaved}
          />
          <MenuSection
            slug={slug}
            location="FOOTER"
            title="Footer menu"
            description="Links shown in the website footer."
            items={footerItems}
            savedItems={footerSaved}
            pages={pages}
            onChange={setFooterItems}
            onSaved={setFooterSaved}
          />
        </div>
      )}
    </div>
  )
}
