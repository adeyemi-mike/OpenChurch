'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronUp,
  HandCoins,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Tags,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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

type GivingMode = 'EXTERNAL' | 'BANK' | 'CUSTOM'
type GivingProvider = 'NONE' | 'PAYSTACK' | 'STRIPE'

type GivingSettings = {
  isEnabled: boolean
  isDemo: boolean
  mode: GivingMode
  provider: GivingProvider
  externalUrl: string
  bankDetails: string
  customText: string
}

type GivingCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  sortOrder: number
}

const MODE_OPTIONS: { value: GivingMode; label: string; hint: string }[] = [
  {
    value: 'EXTERNAL',
    label: 'External giving link',
    hint: 'External giving link — Paystack, Stripe Payment Links, or any giving page.',
  },
  { value: 'BANK', label: 'Bank transfer details', hint: 'Bank transfer details shown to visitors on your giving page.' },
  { value: 'CUSTOM', label: 'Custom instructions', hint: 'Custom instructions in your own words (simple markdown).' },
]

const PROVIDER_LABELS: Record<GivingProvider, string> = {
  NONE: 'None',
  PAYSTACK: 'Paystack',
  STRIPE: 'Stripe',
}

export function GivingManager({ slug, role }: { slug: string; role: ChurchRole }) {
  const canManage = can(role, 'giving:manage')

  const [settings, setSettings] = useState<GivingSettings>({
    isEnabled: true,
    isDemo: false,
    mode: 'EXTERNAL',
    provider: 'NONE',
    externalUrl: '',
    bankDetails: '',
    customText: '',
  })
  const [categories, setCategories] = useState<GivingCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newActive, setNewActive] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ settings: GivingSettings; categories: GivingCategory[] }>(
        `/api/dashboard/${slug}/giving`
      )
      setSettings({
        isEnabled: res.settings.isEnabled,
        isDemo: res.settings.isDemo ?? false,
        mode: res.settings.mode,
        provider: res.settings.provider,
        externalUrl: res.settings.externalUrl ?? '',
        bankDetails: res.settings.bankDetails ?? '',
        customText: res.settings.customText ?? '',
      })
      setCategories(res.categories)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load giving settings.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  /** Reload only the category list — keeps unsaved settings edits intact. */
  const refreshCategories = useCallback(async () => {
    try {
      const res = await apiFetch<{ categories: GivingCategory[] }>(`/api/dashboard/${slug}/giving`)
      setCategories(res.categories)
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not refresh categories.')
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  async function saveSettings() {
    setSaving(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/giving`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      })
      toast.success('Giving settings saved.')
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the giving settings.')
    } finally {
      setSaving(false)
    }
  }

  async function addCategory() {
    if (newName.trim().length < 2) {
      toast.error('Give the category a name (at least 2 characters).')
      return
    }
    setAdding(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/giving/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim(), isActive: newActive }),
      })
      toast.success('Category added.')
      setAddOpen(false)
      setNewName('')
      setNewDescription('')
      setNewActive(true)
      refreshCategories()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not add the category.')
    } finally {
      setAdding(false)
    }
  }

  const modeHint = MODE_OPTIONS.find((m) => m.value === settings.mode)?.hint ?? ''

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground" role="status">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    )
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm"
      >
        {error}
      </p>
    )
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <HandCoins className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
        <p className="mt-3 font-semibold">Giving is owner-managed</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the church owner can change giving settings in this version.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Giving</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How your church receives giving online — categories, links and instructions.
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          Save settings
        </Button>
      </div>

      {/* Online giving */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="size-4 text-muted-foreground" aria-hidden /> Online giving
          </CardTitle>
          <CardDescription>
            These settings power the giving page on your website.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border px-3.5 py-3">
            <Label htmlFor="giving-enabled" className="mb-0">
              Show giving on the website
            </Label>
            <Switch
              id="giving-enabled"
              checked={settings.isEnabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, isEnabled: v }))}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-dashed px-3.5 py-3">
            <div>
              <Label htmlFor="giving-demo" className="mb-0">
                Demonstration content
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Turn on when the giving details are fictional placeholders (e.g. demo
                bank accounts or example payment links). The public page then labels
                them clearly — visitors are never misled into thinking real payments
                are accepted.
              </p>
            </div>
            <Switch
              id="giving-demo"
              checked={settings.isDemo}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, isDemo: v }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="giving-mode">Giving mode</Label>
            <Select
              value={settings.mode}
              onValueChange={(v) => setSettings((s) => ({ ...s, mode: v as GivingMode }))}
            >
              <SelectTrigger id="giving-mode" className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{modeHint}</p>
          </div>

          {settings.mode === 'EXTERNAL' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="giving-provider">Provider</Label>
                <Select
                  value={settings.provider}
                  onValueChange={(v) => setSettings((s) => ({ ...s, provider: v as GivingProvider }))}
                >
                  <SelectTrigger id="giving-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROVIDER_LABELS) as GivingProvider[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PROVIDER_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Optional label — used to show a “Give via Paystack/Stripe” button.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="giving-url">Giving page URL</Label>
                <Input
                  id="giving-url"
                  value={settings.externalUrl}
                  onChange={(e) => setSettings((s) => ({ ...s, externalUrl: e.target.value }))}
                  placeholder="https://paystack.shop/your-church"
                  maxLength={500}
                />
              </div>
            </div>
          ) : null}

          {settings.mode === 'BANK' ? (
            <div className="space-y-1.5">
              <Label htmlFor="giving-bank">Bank transfer details</Label>
              <Textarea
                id="giving-bank"
                rows={6}
                className="font-mono text-xs leading-relaxed"
                value={settings.bankDetails}
                onChange={(e) => setSettings((s) => ({ ...s, bankDetails: e.target.value }))}
                placeholder={'Bank name\nAccount name\nAccount number\nSort / routing code'}
                maxLength={4000}
              />
              <p className="text-xs text-muted-foreground">
                Shown exactly as written — double-check the account details before saving.
              </p>
            </div>
          ) : null}

          {settings.mode === 'CUSTOM' ? (
            <div className="space-y-1.5">
              <Label htmlFor="giving-custom">Custom instructions</Label>
              <Textarea
                id="giving-custom"
                rows={6}
                value={settings.customText}
                onChange={(e) => setSettings((s) => ({ ...s, customText: e.target.value }))}
                placeholder="Tell visitors how to give — e.g. give in person on Sundays, or via our mobile app."
                maxLength={4000}
              />
              <p className="text-xs text-muted-foreground">
                Simple markdown is supported (e.g. **bold**, [links](https://…) and lists).
              </p>
            </div>
          ) : null}

          {/* Honest security note */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-amber-900">
            <ShieldCheck className="mt-0.5 size-4.5 shrink-0" aria-hidden />
            <p className="text-sm leading-snug">
              OpenChurch never stores card details. Direct payment-processing integrations (Paystack/Stripe
              APIs) are planned — today this module links to your existing provider page.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tags className="size-4 text-muted-foreground" aria-hidden /> Giving categories
            </CardTitle>
            <CardDescription>
              Funds visitors can designate — e.g. Tithes, Offerings, Missions. Changes save immediately.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden /> Add category
          </Button>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center">
              <Tags className="size-7 mx-auto text-muted-foreground/50" aria-hidden />
              <p className="mt-3 font-medium">No giving categories yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add categories like “Tithes” or “Building Fund” so visitors can designate their giving.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" aria-hidden /> Add the first category
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {categories.map((category, index) => (
                <li key={category.id} className="py-3.5 first:pt-0 last:pb-0">
                  <CategoryRow
                    slug={slug}
                    category={category}
                    canMoveUp={index > 0}
                    canMoveDown={index < categories.length - 1}
                    onChanged={refreshCategories}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a giving category</DialogTitle>
            <DialogDescription>
              Visitors will see this as a designation option on your giving page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gc-name">Name *</Label>
              <Input
                id="gc-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Building Fund"
                autoFocus
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-desc">Description (optional)</Label>
              <Input
                id="gc-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What this fund is used for"
                maxLength={1000}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3.5 py-3">
              <Label htmlFor="gc-active" className="mb-0">
                Show on the website
              </Label>
              <Switch id="gc-active" checked={newActive} onCheckedChange={setNewActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addCategory} disabled={adding}>
              {adding ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Add category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CategoryRow({
  slug,
  category,
  canMoveUp,
  canMoveDown,
  onChanged,
}: {
  slug: string
  category: GivingCategory
  canMoveUp: boolean
  canMoveDown: boolean
  onChanged: () => void
}) {
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description ?? '')
  const [busy, setBusy] = useState(false)
  const dirty = name !== category.name || description !== (category.description ?? '')

  async function patch(body: Record<string, unknown>, successMessage?: string) {
    setBusy(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/giving/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (successMessage) toast.success(successMessage)
      onChanged()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update the category.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete “${category.name}”? This cannot be undone.`)) return
    setBusy(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/giving/categories/${category.id}`, { method: 'DELETE' })
      toast.success('Category deleted.')
      onChanged()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the category.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={`Name for ${category.name}`}
            maxLength={120}
            className="h-9"
          />
          {!category.isActive ? <Badge variant="outline">Hidden</Badge> : null}
        </div>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label={`Description for ${category.name}`}
          placeholder="Description (optional)"
          maxLength={1000}
          className="h-9"
        />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <div className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5">
          <Label htmlFor={`cat-active-${category.id}`} className="text-xs text-muted-foreground">
            Active
          </Label>
          <Switch
            id={`cat-active-${category.id}`}
            checked={category.isActive}
            disabled={busy}
            onCheckedChange={(v) => patch({ isActive: v })}
            aria-label={`Show ${category.name} on the website`}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          disabled={busy || !canMoveUp}
          onClick={() => patch({ move: 'up' })}
          aria-label={`Move ${category.name} up`}
        >
          <ChevronUp className="size-4" aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          disabled={busy || !canMoveDown}
          onClick={() => patch({ move: 'down' })}
          aria-label={`Move ${category.name} down`}
        >
          <ChevronDown className="size-4" aria-hidden />
        </Button>
        {dirty ? (
          <Button size="sm" onClick={() => patch({ name: name.trim(), description })} disabled={busy || name.trim().length < 2}>
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
            Save
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={remove}
          disabled={busy}
          aria-label={`Delete ${category.name}`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
