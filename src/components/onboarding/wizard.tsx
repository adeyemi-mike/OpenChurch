'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Church,
  Palette,
  Users,
  LayoutTemplate,
  Rocket,
  Check,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Globe2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { ColorPicker } from '@/components/onboarding/color-picker'
import { ImageUploadField } from '@/components/onboarding/image-upload-field'
import { THEMES } from '@/lib/themes/registry'
import { FONTS } from '@/lib/themes/fonts'
import { COUNTRIES, CURRENCIES, TIMEZONES, DAY_NAMES } from '@/lib/format'
import { slugify } from '@/lib/slug'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'openchurch_onboarding_v1'

type LeaderRow = { name: string; title: string; bio: string }
type MinistryRow = { name: string; description: string; leaderName: string; meetingTime: string }
type ServiceRow = { name: string; dayOfWeek: number; startTime: string; endTime: string; notes: string }
type LocationRow = { name: string; address: string; city: string; country: string }

type WizardState = {
  step: number
  info: {
    name: string
    denomination: string
    country: string
    region: string
    city: string
    address: string
    phone: string
    email: string
    timezone: string
    currency: string
  }
  slug: string
  slugTouched: boolean
  identity: {
    primaryColor: string
    secondaryColor: string
    fontKey: string
    logoUrl: string
    heroImageUrl: string
  }
  structure: {
    leaders: LeaderRow[]
    ministries: MinistryRow[]
    services: ServiceRow[]
    locations: LocationRow[]
  }
  design: { themeKey: string }
  publish: boolean
}

const INITIAL: WizardState = {
  step: 1,
  info: {
    name: '',
    denomination: '',
    country: 'NG',
    region: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  },
  slug: '',
  slugTouched: false,
  identity: { primaryColor: '#0F5C4E', secondaryColor: '#B45309', fontKey: 'sans', logoUrl: '', heroImageUrl: '' },
  structure: { leaders: [], ministries: [], services: [], locations: [] },
  design: { themeKey: 'modern' },
  publish: true,
}

const STEPS = [
  { n: 1, label: 'Church information', icon: Church },
  { n: 2, label: 'Church identity', icon: Palette },
  { n: 3, label: 'Church structure', icon: Users },
  { n: 4, label: 'Website design', icon: LayoutTemplate },
  { n: 5, label: 'Publish', icon: Rocket },
]

function loadState(): WizardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...INITIAL, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return INITIAL
}

export function OnboardingWizard({ userName }: { userName: string }) {
  const router = useRouter()
  const [state, setState] = useState<WizardState>(INITIAL)
  const [hydrated, setHydrated] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [heroFile, setHeroFile] = useState<File | null>(null)
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')
  const [slugReason, setSlugReason] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore saved progress after mount (async so the first paint is stable).
  useEffect(() => {
    const timer = setTimeout(() => {
      setState(loadState())
      setHydrated(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state, hydrated])

  const patch = (fn: (draft: WizardState) => WizardState) => setState((s) => fn({ ...s }))

  // Auto-slug from church name until the user edits it (derived at input time)
  function setChurchName(name: string) {
    patch((d) => ({
      ...d,
      info: { ...d.info, name },
      slug: d.slugTouched ? d.slug : slugify(name).slice(0, 40),
    }))
  }

  // Debounced slug availability check — state updates happen inside async
  // timer callbacks only.
  const slug = state.slug
  useEffect(() => {
    if (!slug || slug.length < 2) {
      const t = setTimeout(() => {
        setSlugStatus('idle')
        setSlugReason(null)
      }, 0)
      return () => clearTimeout(t)
    }
    const t0 = setTimeout(() => setSlugStatus('checking'), 0)
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<{ available: boolean; reason: string | null }>(
          `/api/onboarding/slug?slug=${encodeURIComponent(slug)}`
        )
        setSlugStatus(res.available ? 'ok' : 'bad')
        setSlugReason(res.reason)
      } catch {
        setSlugStatus('idle')
      }
    }, 450)
    return () => {
      clearTimeout(t0)
      clearTimeout(timer)
    }
  }, [slug])

  const step1Valid =
    state.info.name.trim().length >= 2 &&
    state.info.country.length === 2 &&
    state.slug.length >= 2 &&
    slugStatus !== 'bad'

  const next = () => {
    if (state.step === 1 && !step1Valid) {
      toast.error('Please complete the church name, country and web address.')
      return
    }
    setError(null)
    patch((d) => ({ ...d, step: Math.min(5, d.step + 1) }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const back = () => patch((d) => ({ ...d, step: Math.max(1, d.step - 1) }))

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const created = await apiFetch<{ slug: string; id: string }>('/api/onboarding/church', {
        method: 'POST',
        body: JSON.stringify({
          slug: state.slug,
          info: state.info,
          identity: state.identity,
          structure: state.structure,
          design: state.design,
          publish: state.publish,
        }),
      })

      // Upload chosen images (best-effort — the church exists already)
      const uploads: Array<{ file: File; field: 'logoUrl' | 'heroImageUrl' }> = []
      if (logoFile) uploads.push({ file: logoFile, field: 'logoUrl' })
      if (heroFile) uploads.push({ file: heroFile, field: 'heroImageUrl' })
      for (const { file, field } of uploads) {
        try {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('folder', 'Branding')
          const asset = await apiFetch<{ id: string; url: string }>(
            `/api/dashboard/${created.slug}/media`,
            { method: 'POST', body: fd }
          )
          await apiFetch(`/api/dashboard/${created.slug}/settings`, {
            method: 'PATCH',
            body: JSON.stringify({ [field]: asset.url }),
          })
        } catch (err) {
          console.warn('Logo/hero upload failed', err)
          toast.warning(`Your website is ready, but the ${field === 'logoUrl' ? 'logo' : 'hero image'} upload failed — you can add it later in Appearance.`)
        }
      }

      localStorage.removeItem(STORAGE_KEY)
      toast.success(`${state.info.name} is ready${state.publish ? ' and live!' : '.'}`)
      router.push(`/console/${created.slug}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong creating your church. Please try again.')
      setSubmitting(false)
    }
  }

  const theme = useMemo(() => THEMES.find((t) => t.key === state.design.themeKey) ?? THEMES[0], [state.design.themeKey])

  if (!hydrated) {
    return (
      <div className="grid place-items-center py-24" role="status" aria-label="Loading">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Set up your church website</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome, {userName.split(' ')[0]}! Five quick steps — you can skip anything optional and
          return later.
        </p>
      </div>

      {/* Progress */}
      <ol className="mt-8 flex items-center justify-between gap-1" aria-label="Onboarding progress">
        {STEPS.map((s, i) => {
          const done = state.step > s.n
          const active = state.step === s.n
          return (
            <li key={s.n} className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => s.n < state.step && patch((d) => ({ ...d, step: s.n }))}
                disabled={s.n >= state.step}
                className="w-full text-left group disabled:cursor-default"
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full transition-colors',
                    done ? 'bg-primary' : active ? 'bg-primary/50' : 'bg-border'
                  )}
                />
                <span
                  className={cn(
                    'mt-2 hidden sm:flex items-center gap-1.5 text-xs font-medium',
                    active ? 'text-foreground' : done ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <s.icon className="size-3.5" aria-hidden />
                  <span className="truncate">{s.label}</span>
                  {done && <Check className="size-3.5 shrink-0" aria-hidden />}
                </span>
                <span className="sm:hidden mt-1 block text-[10px] text-muted-foreground">Step {i + 1}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {error ? (
        <div role="alert" className="mt-6 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3">
          {error}
        </div>
      ) : null}

      {/* Step 1: Church information */}
      {state.step === 1 && (
        <Card className="mt-8">
          <CardContent className="p-6 sm:p-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="church-name">Church name *</Label>
              <Input
                id="church-name"
                value={state.info.name}
                onChange={(e) => setChurchName(e.target.value)}
                placeholder="e.g. Grace Community Church"
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="denomination">Denomination / tradition</Label>
                <Input
                  id="denomination"
                  value={state.info.denomination}
                  onChange={(e) => patch((d) => ({ ...d, info: { ...d.info, denomination: e.target.value } }))}
                  placeholder="Optional — e.g. Baptist, Pentecostal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Select
                  value={state.info.country}
                  onValueChange={(v) =>
                    patch((d) => ({
                      ...d,
                      info: {
                        ...d.info,
                        country: v,
                        timezone: suggestTimezone(v, d.info.timezone),
                        currency: suggestCurrency(v, d.info.currency),
                      },
                    }))
                  }
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="region">State / region</Label>
                <Input
                  id="region"
                  value={state.info.region}
                  onChange={(e) => patch((d) => ({ ...d, info: { ...d.info, region: e.target.value } }))}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={state.info.city}
                  onChange={(e) => patch((d) => ({ ...d, info: { ...d.info, city: e.target.value } }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Street address</Label>
              <Input
                id="address"
                value={state.info.address}
                onChange={(e) => patch((d) => ({ ...d, info: { ...d.info, address: e.target.value } }))}
                placeholder="Optional"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={state.info.phone}
                  onChange={(e) => patch((d) => ({ ...d, info: { ...d.info, phone: e.target.value } }))}
                  placeholder="International format, e.g. +234 801 234 5678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="church-email">Church email</Label>
                <Input
                  id="church-email"
                  type="email"
                  value={state.info.email}
                  onChange={(e) => patch((d) => ({ ...d, info: { ...d.info, email: e.target.value } }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="timezone">Time zone</Label>
                <Select
                  value={state.info.timezone}
                  onValueChange={(v) => patch((d) => ({ ...d, info: { ...d.info, timezone: v } }))}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={state.info.currency}
                  onValueChange={(v) => patch((d) => ({ ...d, info: { ...d.info, currency: v } }))}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Website address *</Label>
              <div className="flex items-center rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-3 pr-1.5 text-sm text-muted-foreground select-none">/church/</span>
                <Input
                  id="slug"
                  value={state.slug}
                  onChange={(e) =>
                    patch((d) => ({
                      ...d,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      slugTouched: true,
                    }))
                  }
                  className="border-0 focus-visible:ring-0 font-medium"
                  placeholder="your-church"
                  aria-describedby="slug-status"
                />
              </div>
              <p id="slug-status" className="text-xs" role="status">
                {slugStatus === 'checking' && <span className="text-muted-foreground">Checking availability…</span>}
                {slugStatus === 'ok' && (
                  <span className="text-emerald-700 inline-flex items-center gap-1">
                    <Check className="size-3.5" aria-hidden /> {state.slug} is available
                  </span>
                )}
                {slugStatus === 'bad' && <span className="text-destructive">{slugReason ?? 'Not available.'}</span>}
                {slugStatus === 'idle' && (
                  <span className="text-muted-foreground">
                    This becomes your free address — it always works. Custom domains (e.g.
                    yourchurch.org) are supported on self-hosted and managed-hosting deployments;
                    see Dashboard → Custom domains.
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Church identity */}
      {state.step === 2 && (
        <Card className="mt-8">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <ImageUploadField
              label="Church logo"
              hint="Square works best"
              recommended="512×512px"
              value={state.identity.logoUrl}
              onChange={(url) => patch((d) => ({ ...d, identity: { ...d.identity, logoUrl: url } }))}
              file={logoFile}
              onFileChange={setLogoFile}
            />
            <ImageUploadField
              label="Hero / banner image"
              hint="The large image at the top of your homepage"
              recommended="1920×1080px"
              value={state.identity.heroImageUrl}
              onChange={(url) => patch((d) => ({ ...d, identity: { ...d.identity, heroImageUrl: url } }))}
              file={heroFile}
              onFileChange={setHeroFile}
            />
            <ColorPicker
              label="Primary colour"
              value={state.identity.primaryColor}
              onChange={(hex) => patch((d) => ({ ...d, identity: { ...d.identity, primaryColor: hex } }))}
            />
            <ColorPicker
              label="Secondary colour"
              value={state.identity.secondaryColor}
              onChange={(hex) => patch((d) => ({ ...d, identity: { ...d.identity, secondaryColor: hex } }))}
            />
            <div className="space-y-2">
              <Label>Typography</Label>
              <div className="grid sm:grid-cols-2 gap-3">
                {FONTS.map((font) => (
                  <button
                    key={font.key}
                    type="button"
                    onClick={() => patch((d) => ({ ...d, identity: { ...d.identity, fontKey: font.key } }))}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-colors hover:border-primary/50',
                      state.identity.fontKey === font.key && 'border-primary ring-1 ring-ring'
                    )}
                    aria-pressed={state.identity.fontKey === font.key}
                  >
                    <p
                      className="font-semibold text-lg"
                      style={{ fontFamily: `var(${font.headingVar}), serif` }}
                    >
                      The grace of God
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{font.label} — {font.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Church structure */}
      {state.step === 3 && (
        <div className="mt-8 space-y-6">
          <p className="text-sm text-muted-foreground -mb-2">
            Everything here is optional — you can add and edit all of this later from the dashboard.
          </p>

          {/* Leaders */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <fieldset>
                <legend className="font-semibold">Leadership team</legend>
                <p className="text-xs text-muted-foreground mt-0.5">Senior pastor, elders, key staff…</p>
                <div className="mt-4 space-y-3">
                  {state.structure.leaders.map((leader, i) => (
                    <div key={i} className="rounded-lg border p-3 grid sm:grid-cols-[1fr_1fr_auto] gap-3">
                      <Input
                        placeholder="Full name"
                        aria-label={`Leader ${i + 1} name`}
                        value={leader.name}
                        onChange={(e) =>
                          patch((d) => {
                            const leaders = [...d.structure.leaders]
                            leaders[i] = { ...leader, name: e.target.value }
                            return { ...d, structure: { ...d.structure, leaders } }
                          })
                        }
                      />
                      <Input
                        placeholder="Role, e.g. Senior Pastor"
                        aria-label={`Leader ${i + 1} role`}
                        value={leader.title}
                        onChange={(e) =>
                          patch((d) => {
                            const leaders = [...d.structure.leaders]
                            leaders[i] = { ...leader, title: e.target.value }
                            return { ...d, structure: { ...d.structure, leaders } }
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove leader ${i + 1}`}
                        onClick={() =>
                          patch((d) => ({
                            ...d,
                            structure: { ...d.structure, leaders: d.structure.leaders.filter((_, j) => j !== i) },
                          }))
                        }
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                      <Textarea
                        placeholder="Short bio (optional)"
                        aria-label={`Leader ${i + 1} bio`}
                        className="sm:col-span-3"
                        rows={2}
                        value={leader.bio}
                        onChange={(e) =>
                          patch((d) => {
                            const leaders = [...d.structure.leaders]
                            leaders[i] = { ...leader, bio: e.target.value }
                            return { ...d, structure: { ...d.structure, leaders } }
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    patch((d) => ({
                      ...d,
                      structure: { ...d.structure, leaders: [...d.structure.leaders, { name: '', title: '', bio: '' }] },
                    }))
                  }
                >
                  <Plus className="size-4" aria-hidden /> Add leader
                </Button>
              </fieldset>
            </CardContent>
          </Card>

          {/* Ministries */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <fieldset>
                <legend className="font-semibold">Ministries</legend>
                <p className="text-xs text-muted-foreground mt-0.5">Children, youth, worship, outreach…</p>
                <div className="mt-4 space-y-3">
                  {state.structure.ministries.map((m, i) => (
                    <div key={i} className="rounded-lg border p-3 grid sm:grid-cols-[1fr_1fr_auto] gap-3">
                      <Input
                        placeholder="Ministry name"
                        aria-label={`Ministry ${i + 1} name`}
                        value={m.name}
                        onChange={(e) =>
                          patch((d) => {
                            const ministries = [...d.structure.ministries]
                            ministries[i] = { ...m, name: e.target.value }
                            return { ...d, structure: { ...d.structure, ministries } }
                          })
                        }
                      />
                      <Input
                        placeholder="Leader (optional)"
                        aria-label={`Ministry ${i + 1} leader`}
                        value={m.leaderName}
                        onChange={(e) =>
                          patch((d) => {
                            const ministries = [...d.structure.ministries]
                            ministries[i] = { ...m, leaderName: e.target.value }
                            return { ...d, structure: { ...d.structure, ministries } }
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ministry ${i + 1}`}
                        onClick={() =>
                          patch((d) => ({
                            ...d,
                            structure: { ...d.structure, ministries: d.structure.ministries.filter((_, j) => j !== i) },
                          }))
                        }
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                      <Textarea
                        placeholder="What does this ministry do? (optional)"
                        aria-label={`Ministry ${i + 1} description`}
                        className="sm:col-span-3"
                        rows={2}
                        value={m.description}
                        onChange={(e) =>
                          patch((d) => {
                            const ministries = [...d.structure.ministries]
                            ministries[i] = { ...m, description: e.target.value }
                            return { ...d, structure: { ...d.structure, ministries } }
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    patch((d) => ({
                      ...d,
                      structure: {
                        ...d.structure,
                        ministries: [...d.structure.ministries, { name: '', description: '', leaderName: '', meetingTime: '' }],
                      },
                    }))
                  }
                >
                  <Plus className="size-4" aria-hidden /> Add ministry
                </Button>
              </fieldset>
            </CardContent>
          </Card>

          {/* Services */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <fieldset>
                <legend className="font-semibold">Service times</legend>
                <p className="text-xs text-muted-foreground mt-0.5">Weekly gatherings — these appear on your homepage.</p>
                <div className="mt-4 space-y-3">
                  {state.structure.services.map((s, i) => (
                    <div key={i} className="rounded-lg border p-3 grid grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-end">
                      <div className="col-span-2 sm:col-span-1">
                        <Input
                          placeholder="Service name, e.g. Sunday Worship"
                          aria-label={`Service ${i + 1} name`}
                          value={s.name}
                          onChange={(e) =>
                            patch((d) => {
                              const services = [...d.structure.services]
                              services[i] = { ...s, name: e.target.value }
                              return { ...d, structure: { ...d.structure, services } }
                            })
                          }
                        />
                      </div>
                      <Select
                        value={String(s.dayOfWeek)}
                        onValueChange={(v) =>
                          patch((d) => {
                            const services = [...d.structure.services]
                            services[i] = { ...s, dayOfWeek: Number(v) }
                            return { ...d, structure: { ...d.structure, services } }
                          })
                        }
                      >
                        <SelectTrigger aria-label={`Service ${i + 1} day`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_NAMES.map((day, di) => (
                            <SelectItem key={day} value={String(di)}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="time"
                        aria-label={`Service ${i + 1} start time`}
                        value={s.startTime}
                        onChange={(e) =>
                          patch((d) => {
                            const services = [...d.structure.services]
                            services[i] = { ...s, startTime: e.target.value }
                            return { ...d, structure: { ...d.structure, services } }
                          })
                        }
                      />
                      <Input
                        type="time"
                        aria-label={`Service ${i + 1} end time`}
                        value={s.endTime}
                        onChange={(e) =>
                          patch((d) => {
                            const services = [...d.structure.services]
                            services[i] = { ...s, endTime: e.target.value }
                            return { ...d, structure: { ...d.structure, services } }
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove service ${i + 1}`}
                        onClick={() =>
                          patch((d) => ({
                            ...d,
                            structure: { ...d.structure, services: d.structure.services.filter((_, j) => j !== i) },
                          }))
                        }
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    patch((d) => ({
                      ...d,
                      structure: {
                        ...d.structure,
                        services: [...d.structure.services, { name: 'Sunday Service', dayOfWeek: 0, startTime: '10:00', endTime: '', notes: '' }],
                      },
                    }))
                  }
                >
                  <Plus className="size-4" aria-hidden /> Add service
                </Button>
              </fieldset>
            </CardContent>
          </Card>

          {/* Locations */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <fieldset>
                <legend className="font-semibold">Locations / branches</legend>
                <p className="text-xs text-muted-foreground mt-0.5">
                  If your church meets at more than one place, add each venue.
                </p>
                <div className="mt-4 space-y-3">
                  {state.structure.locations.map((l, i) => (
                    <div key={i} className="rounded-lg border p-3 grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3">
                      <Input
                        placeholder="Venue name, e.g. Main Auditorium"
                        aria-label={`Location ${i + 1} name`}
                        value={l.name}
                        onChange={(e) =>
                          patch((d) => {
                            const locations = [...d.structure.locations]
                            locations[i] = { ...l, name: e.target.value }
                            return { ...d, structure: { ...d.structure, locations } }
                          })
                        }
                      />
                      <Input
                        placeholder="Address"
                        aria-label={`Location ${i + 1} address`}
                        value={l.address}
                        onChange={(e) =>
                          patch((d) => {
                            const locations = [...d.structure.locations]
                            locations[i] = { ...l, address: e.target.value }
                            return { ...d, structure: { ...d.structure, locations } }
                          })
                        }
                      />
                      <Input
                        placeholder="City"
                        aria-label={`Location ${i + 1} city`}
                        value={l.city}
                        onChange={(e) =>
                          patch((d) => {
                            const locations = [...d.structure.locations]
                            locations[i] = { ...l, city: e.target.value }
                            return { ...d, structure: { ...d.structure, locations } }
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove location ${i + 1}`}
                        onClick={() =>
                          patch((d) => ({
                            ...d,
                            structure: { ...d.structure, locations: d.structure.locations.filter((_, j) => j !== i) },
                          }))
                        }
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    patch((d) => ({
                      ...d,
                      structure: {
                        ...d.structure,
                        locations: [...d.structure.locations, { name: '', address: '', city: '', country: d.info.country }],
                      },
                    }))
                  }
                >
                  <Plus className="size-4" aria-hidden /> Add location
                </Button>
              </fieldset>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Website design */}
      {state.step === 4 && (
        <Card className="mt-8">
          <CardContent className="p-6 sm:p-8 space-y-5">
            <div>
              <Label>Choose a starting theme</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Themes are starting points — colours, fonts and sections stay fully customisable.
              </p>
            </div>
            <div className="grid gap-4">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => patch((d) => ({ ...d, design: { themeKey: t.key } }))}
                  className={cn(
                    'rounded-xl border p-5 text-left transition-colors hover:border-primary/50',
                    state.design.themeKey === t.key && 'border-primary ring-1 ring-ring'
                  )}
                  aria-pressed={state.design.themeKey === t.key}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-sm text-muted-foreground">{t.tagline}</p>
                    </div>
                    <span
                      className={cn(
                        'grid place-items-center size-6 rounded-full border-2 shrink-0',
                        state.design.themeKey === t.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                      )}
                    >
                      {state.design.themeKey === t.key && <Check className="size-3.5" aria-hidden />}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground/80">{t.description}</p>
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-muted/50 border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground flex items-center gap-2">
                <Globe2 className="size-4" aria-hidden /> Your homepage will start with:
              </p>
              <p className="mt-1.5 leading-relaxed">
                Hero banner · Service schedule · About intro · Upcoming events · Recent sermons ·
                Ministry cards · Call to action — all editable in the page builder, with About and
                Contact pages ready to go.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Publish */}
      {state.step === 5 && (
        <Card className="mt-8">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="rounded-xl border p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Review</p>
              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Church</dt>
                  <dd className="font-medium">{state.info.name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="font-medium">
                    {[state.info.city, state.info.country].filter(Boolean).join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Website</dt>
                  <dd className="font-medium font-mono text-xs pt-1">/church/{state.slug || '…'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Theme</dt>
                  <dd className="font-medium">{theme.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Branding</dt>
                  <dd className="font-medium flex items-center gap-2 pt-0.5">
                    <span className="size-4 rounded-full border" style={{ background: state.identity.primaryColor }} />
                    <span className="size-4 rounded-full border" style={{ background: state.identity.secondaryColor }} />
                    {logoFile || state.identity.logoUrl ? '· logo ready' : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Structure</dt>
                  <dd className="font-medium">
                    {state.structure.leaders.length} leaders · {state.structure.ministries.length} ministries ·{' '}
                    {state.structure.services.length} services
                  </dd>
                </div>
              </dl>
            </div>
            <label className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer">
              <Switch
                checked={state.publish}
                onCheckedChange={(v) => patch((d) => ({ ...d, publish: v }))}
                aria-label="Publish the website immediately"
              />
              <span className="text-sm">
                <span className="font-medium">Publish my website immediately</span>
                <span className="block text-muted-foreground">
                  Your site goes live at /church/{state.slug}. You can unpublish anytime from Website Settings.
                </span>
              </span>
            </label>
            {error ? (
              <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3">
                {error}
              </div>
            ) : null}
            <Button size="lg" className="w-full" onClick={submit} disabled={submitting || slugStatus === 'bad' || !step1Valid}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Creating your church…
                </>
              ) : (
                <>
                  <Rocket className="size-4" aria-hidden /> {state.publish ? 'Publish website' : 'Save and finish'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Nav buttons */}
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={back} disabled={state.step === 1 || submitting}>
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Button>
        <div className="flex items-center gap-3">
          {state.step > 1 && state.step < 5 && (
            <Button variant="ghost" onClick={next} disabled={submitting} className="text-muted-foreground">
              Skip for now
            </Button>
          )}
          {state.step < 5 ? (
            <Button onClick={next} disabled={state.step === 1 && !step1Valid}>
              Continue <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <Link href="/console">Go to dashboard without creating</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function suggestTimezone(country: string, current: string): string {
  const map: Record<string, string> = {
    NG: 'Africa/Lagos',
    GB: 'Europe/London',
    IE: 'Europe/Dublin',
    US: 'America/New_York',
    CA: 'America/Toronto',
    GH: 'Africa/Accra',
    KE: 'Africa/Nairobi',
    ZA: 'Africa/Johannesburg',
    AU: 'Australia/Sydney',
    DE: 'Europe/Berlin',
    FR: 'Europe/Paris',
    NL: 'Europe/Paris',
    BR: 'America/Sao_Paulo',
    PH: 'Asia/Manila',
    IN: 'Asia/Kolkata',
  }
  return map[country] ?? current
}

function suggestCurrency(country: string, current: string): string {
  const map: Record<string, string> = {
    NG: 'NGN',
    GB: 'GBP',
    IE: 'EUR',
    US: 'USD',
    CA: 'CAD',
    GH: 'GHS',
    KE: 'KES',
    ZA: 'ZAR',
    AU: 'AUD',
    DE: 'EUR',
    FR: 'EUR',
    NL: 'EUR',
    BR: 'BRL',
    PH: 'PHP',
    IN: 'INR',
  }
  return map[country] ?? current
}
