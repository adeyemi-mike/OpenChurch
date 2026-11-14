'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Building2,
  CalendarClock,
  Loader2,
  MapPin,
  Plus,
  Save,
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
import { COUNTRIES, CURRENCIES, DAY_NAMES, TIMEZONES } from '@/lib/format'

type ProfileDto = {
  id: string
  slug: string
  name: string
  denomination: string | null
  description: string | null
  foundedYear: number | null
  country: string
  region: string | null
  city: string | null
  address: string | null
  postalCode: string | null
  phone: string | null
  email: string | null
  timezone: string
  currency: string
  dateFormat: string
}

type ProfileForm = {
  name: string
  denomination: string
  description: string
  foundedYear: string
  country: string
  region: string
  city: string
  address: string
  postalCode: string
  phone: string
  email: string
  timezone: string
  currency: string
  dateFormat: 'short' | 'medium' | 'long'
}

type ServiceRow = {
  id: string
  name: string
  dayOfWeek: number
  startTime: string
  endTime: string | null
  notes: string | null
  locationId: string | null
  locationName: string | null
}

type LocationRow = {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  mapUrl: string | null
  isPrimary: boolean
}

type ServiceForm = {
  name: string
  dayOfWeek: string
  startTime: string
  endTime: string
  notes: string
  locationId: string
}

type LocationForm = {
  name: string
  address: string
  city: string
  country: string
  mapUrl: string
  isPrimary: boolean
}

const DATE_FORMAT_OPTIONS: { value: ProfileForm['dateFormat']; label: string }[] = [
  { value: 'short', label: 'Short — 12 Aug 2026' },
  { value: 'medium', label: 'Medium — Wed, 12 Aug 2026' },
  { value: 'long', label: 'Long — Wednesday, 12 August 2026' },
]

function toProfileForm(p: ProfileDto): ProfileForm {
  return {
    name: p.name,
    denomination: p.denomination ?? '',
    description: p.description ?? '',
    foundedYear: p.foundedYear === null ? '' : String(p.foundedYear),
    country: p.country,
    region: p.region ?? '',
    city: p.city ?? '',
    address: p.address ?? '',
    postalCode: p.postalCode ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    timezone: p.timezone,
    currency: p.currency,
    dateFormat: (['short', 'medium', 'long'] as const).includes(
      p.dateFormat as ProfileForm['dateFormat']
    )
      ? (p.dateFormat as ProfileForm['dateFormat'])
      : 'medium',
  }
}

function toServiceForm(s: ServiceRow): ServiceForm {
  return {
    name: s.name,
    dayOfWeek: String(s.dayOfWeek),
    startTime: s.startTime,
    endTime: s.endTime ?? '',
    notes: s.notes ?? '',
    locationId: s.locationId ?? '',
  }
}

function toLocationForm(l: LocationRow): LocationForm {
  return {
    name: l.name,
    address: l.address ?? '',
    city: l.city ?? '',
    country: l.country ?? 'NG',
    mapUrl: l.mapUrl ?? '',
    isPrimary: l.isPrimary,
  }
}

export function ProfileManager({ slug, role }: { slug: string; role: ChurchRole }) {
  const canEdit = can(role, 'church:manage_profile')

  const [profile, setProfile] = useState<ProfileForm | null>(null)
  const [services, setServices] = useState<ServiceRow[]>([])
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<ProfileDto>(`/api/dashboard/${slug}/profile`)
      setProfile(toProfileForm(data))
      if (canEdit) {
        const [servicesRes, locationsRes] = await Promise.all([
          apiFetch<{ services: ServiceRow[] }>(`/api/dashboard/${slug}/services`),
          apiFetch<{ locations: LocationRow[] }>(`/api/dashboard/${slug}/locations`),
        ])
        setServices(servicesRes.services)
        setLocations(locationsRes.locations)
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load the church profile.')
    } finally {
      setLoading(false)
    }
  }, [slug, canEdit])

  useEffect(() => {
    load()
  }, [load])

  async function saveProfile() {
    if (!profile) return
    if (profile.name.trim().length < 2) {
      toast.error('The church name needs at least 2 characters.')
      return
    }
    setSaving(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: profile.name.trim(),
          denomination: profile.denomination.trim(),
          description: profile.description.trim(),
          foundedYear: profile.foundedYear === '' ? null : Number(profile.foundedYear),
          country: profile.country,
          region: profile.region.trim(),
          city: profile.city.trim(),
          address: profile.address.trim(),
          postalCode: profile.postalCode.trim(),
          phone: profile.phone.trim(),
          email: profile.email.trim(),
          timezone: profile.timezone,
          currency: profile.currency,
          dateFormat: profile.dateFormat,
        }),
      })
      toast.success('Church profile saved.')
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the profile.')
    } finally {
      setSaving(false)
    }
  }

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

  if (!profile) return null

  function set<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Church profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Identity, location, contact details and service information for {profile.name || 'your church'}.
          </p>
        </div>
        {canEdit ? (
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Save profile
          </Button>
        ) : null}
      </div>

      {!canEdit ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          You can view this profile, but only the church owner can edit it in this version.
        </p>
      ) : null}

      {/* Section 1 — Church identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" aria-hidden /> Church identity
          </CardTitle>
          <CardDescription>How your church appears on the website and in search results.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Church name *</Label>
              <Input
                id="p-name"
                value={profile.name}
                onChange={(e) => set('name', e.target.value)}
                disabled={!canEdit}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-denomination">Denomination</Label>
              <Input
                id="p-denomination"
                value={profile.denomination}
                onChange={(e) => set('denomination', e.target.value)}
                disabled={!canEdit}
                placeholder="e.g. Baptist, Pentecostal, Non-denominational"
                maxLength={120}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-description">Description</Label>
            <Textarea
              id="p-description"
              rows={4}
              value={profile.description}
              onChange={(e) => set('description', e.target.value)}
              disabled={!canEdit}
              placeholder="A warm paragraph about who you are — shown on your homepage and in search results."
              maxLength={2000}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-founded">Founded year</Label>
              <Input
                id="p-founded"
                type="number"
                min={0}
                max={2100}
                value={profile.foundedYear}
                onChange={(e) => set('foundedYear', e.target.value)}
                disabled={!canEdit}
                placeholder="e.g. 1995"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Location & contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" aria-hidden /> Location &amp; contact
          </CardTitle>
          <CardDescription>Where people find you, and how they reach you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-country">Country</Label>
              <Select
                value={profile.country}
                onValueChange={(v) => set('country', v)}
                disabled={!canEdit}
              >
                <SelectTrigger id="p-country" className="w-full">
                  <SelectValue />
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
            <div className="space-y-1.5">
              <Label htmlFor="p-region">Region / state</Label>
              <Input
                id="p-region"
                value={profile.region}
                onChange={(e) => set('region', e.target.value)}
                disabled={!canEdit}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-city">City</Label>
              <Input
                id="p-city"
                value={profile.city}
                onChange={(e) => set('city', e.target.value)}
                disabled={!canEdit}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-postal">Postal code</Label>
              <Input
                id="p-postal"
                value={profile.postalCode}
                onChange={(e) => set('postalCode', e.target.value)}
                disabled={!canEdit}
                maxLength={20}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-address">Street address</Label>
            <Input
              id="p-address"
              value={profile.address}
              onChange={(e) => set('address', e.target.value)}
              disabled={!canEdit}
              maxLength={240}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-phone">Phone</Label>
              <Input
                id="p-phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => set('phone', e.target.value)}
                disabled={!canEdit}
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-email">Email</Label>
              <Input
                id="p-email"
                type="email"
                value={profile.email}
                onChange={(e) => set('email', e.target.value)}
                disabled={!canEdit}
                maxLength={200}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3 — Locale */}
      <Card>
        <CardHeader>
          <CardTitle>Locale</CardTitle>
          <CardDescription>
            Dates, times and amounts on your website follow these settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-tz">Timezone</Label>
            <Select value={profile.timezone} onValueChange={(v) => set('timezone', v)} disabled={!canEdit}>
              <SelectTrigger id="p-tz" className="w-full">
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
          <div className="space-y-1.5">
            <Label htmlFor="p-currency">Currency</Label>
            <Select value={profile.currency} onValueChange={(v) => set('currency', v)} disabled={!canEdit}>
              <SelectTrigger id="p-currency" className="w-full">
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
          <div className="space-y-1.5">
            <Label htmlFor="p-dateformat">Date format</Label>
            <Select
              value={profile.dateFormat}
              onValueChange={(v) => set('dateFormat', v as ProfileForm['dateFormat'])}
              disabled={!canEdit}
            >
              <SelectTrigger id="p-dateformat" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMAT_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <>
          {/* Section 4 — Service times */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden /> Service times
                </CardTitle>
                <CardDescription>
                  Your weekly gatherings — shown on your website homepage and contact page.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => setServiceDialogOpen(true)}>
                <Plus className="size-4" aria-hidden /> Add service
              </Button>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <div className="rounded-xl border border-dashed py-10 text-center">
                  <CalendarClock className="size-7 mx-auto text-muted-foreground/50" aria-hidden />
                  <p className="mt-3 font-medium">No service times yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your Sunday services, midweek meetings or prayer gatherings.
                  </p>
                  <Button className="mt-4" variant="outline" onClick={() => setServiceDialogOpen(true)}>
                    <Plus className="size-4" aria-hidden /> Add the first service
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {services.map((service) => (
                    <li key={service.id}>
                      <ServiceEditor
                        slug={slug}
                        service={service}
                        locations={locations}
                        onSaved={load}
                        onDeleted={load}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Section 5 — Locations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" aria-hidden /> Locations / branches
                </CardTitle>
                <CardDescription>
                  Campuses or meeting places. The primary location is shown first on your website.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => setLocationDialogOpen(true)}>
                <Plus className="size-4" aria-hidden /> Add location
              </Button>
            </CardHeader>
            <CardContent>
              {locations.length === 0 ? (
                <div className="rounded-xl border border-dashed py-10 text-center">
                  <MapPin className="size-7 mx-auto text-muted-foreground/50" aria-hidden />
                  <p className="mt-3 font-medium">No locations yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add the place your church meets — even “Main auditorium” works if you meet in one hall.
                  </p>
                  <Button className="mt-4" variant="outline" onClick={() => setLocationDialogOpen(true)}>
                    <Plus className="size-4" aria-hidden /> Add the first location
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {locations.map((location) => (
                    <li key={location.id}>
                      <LocationEditor slug={slug} location={location} onSaved={load} onDeleted={load} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Service times and locations are managed by the church owner. Ask an owner if something needs
            to change.
          </CardContent>
        </Card>
      )}

      <ServiceDialog
        slug={slug}
        open={serviceDialogOpen}
        locations={locations}
        onOpenChange={setServiceDialogOpen}
        onCreated={load}
      />
      <LocationDialog
        slug={slug}
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        onCreated={load}
      />
    </div>
  )
}

function ServiceFields({
  value,
  onChange,
  locations,
}: {
  value: ServiceForm
  onChange: (next: ServiceForm) => void
  locations: LocationRow[]
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. Sunday Worship"
          maxLength={120}
          aria-label="Service name"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Day</Label>
        <Select value={value.dayOfWeek} onValueChange={(v) => onChange({ ...value, dayOfWeek: v })}>
          <SelectTrigger className="w-full" aria-label="Day of the week">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAY_NAMES.map((day, i) => (
              <SelectItem key={day} value={String(i)}>
                {day}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Starts</Label>
        <Input
          type="time"
          value={value.startTime}
          onChange={(e) => onChange({ ...value, startTime: e.target.value })}
          aria-label="Start time"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Ends (optional)</Label>
        <Input
          type="time"
          value={value.endTime}
          onChange={(e) => onChange({ ...value, endTime: e.target.value })}
          aria-label="End time"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Location (optional)</Label>
        <Select
          value={value.locationId || 'none'}
          onValueChange={(v) => onChange({ ...value, locationId: v === 'none' ? '' : v })}
        >
          <SelectTrigger className="w-full" aria-label="Service location">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No specific location</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
        <Label>Notes (optional)</Label>
        <Input
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="e.g. Sunday school runs alongside"
          maxLength={200}
          aria-label="Service notes"
        />
      </div>
    </div>
  )
}

function LocationFields({
  value,
  onChange,
}: {
  value: LocationForm
  onChange: (next: LocationForm) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. Main campus"
          maxLength={120}
          aria-label="Location name"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Address</Label>
        <Input
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="Street address"
          maxLength={240}
          aria-label="Location address"
        />
      </div>
      <div className="space-y-1.5">
        <Label>City</Label>
        <Input
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          maxLength={120}
          aria-label="Location city"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Country</Label>
        <Select value={value.country} onValueChange={(v) => onChange({ ...value, country: v })}>
          <SelectTrigger className="w-full" aria-label="Location country">
            <SelectValue />
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
      <div className="space-y-1.5">
        <Label>Map embed URL</Label>
        <Input
          value={value.mapUrl}
          onChange={(e) => onChange({ ...value, mapUrl: e.target.value })}
          placeholder="https://www.google.com/maps/embed?…"
          maxLength={500}
          aria-label="Location map embed URL"
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border px-3.5 py-2.5 lg:col-span-3">
        <div>
          <Label htmlFor="loc-primary" className="mb-0">
            Primary location
          </Label>
          <p className="text-xs text-muted-foreground">Shown first; only one location can be primary.</p>
        </div>
        <Switch
          id="loc-primary"
          checked={value.isPrimary}
          onCheckedChange={(v) => onChange({ ...value, isPrimary: v })}
        />
      </div>
    </div>
  )
}

function serviceBody(form: ServiceForm) {
  return {
    name: form.name.trim(),
    dayOfWeek: Number(form.dayOfWeek),
    startTime: form.startTime,
    endTime: form.endTime,
    notes: form.notes.trim(),
    locationId: form.locationId,
  }
}

function locationBody(form: LocationForm) {
  return {
    name: form.name.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    country: form.country,
    mapUrl: form.mapUrl.trim(),
    isPrimary: form.isPrimary,
  }
}

function ServiceEditor({
  slug,
  service,
  locations,
  onSaved,
  onDeleted,
}: {
  slug: string
  service: ServiceRow
  locations: LocationRow[]
  onSaved: () => void
  onDeleted: () => void
}) {
  const [form, setForm] = useState<ServiceForm>(toServiceForm(service))
  const [busy, setBusy] = useState(false)
  const dirty =
    JSON.stringify(form) !== JSON.stringify(toServiceForm(service))

  async function save() {
    if (form.name.trim().length < 2 || !form.startTime) {
      toast.error('Give the service a name and a start time.')
      return
    }
    setBusy(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/services/${service.id}`, {
        method: 'PATCH',
        body: JSON.stringify(serviceBody(form)),
      })
      toast.success('Service saved.')
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the service.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete the “${service.name}” service time?`)) return
    setBusy(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/services/${service.id}`, { method: 'DELETE' })
      toast.success('Service deleted.')
      onDeleted()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the service.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <ServiceFields value={form} onChange={setForm} locations={locations} />
      <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
        {dirty ? (
          <Button size="sm" onClick={save} disabled={busy}>
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
          aria-label={`Delete ${service.name}`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

function LocationEditor({
  slug,
  location,
  onSaved,
  onDeleted,
}: {
  slug: string
  location: LocationRow
  onSaved: () => void
  onDeleted: () => void
}) {
  const [form, setForm] = useState<LocationForm>(toLocationForm(location))
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(toLocationForm(location))

  async function save() {
    if (form.name.trim().length < 2) {
      toast.error('Give the location a name.')
      return
    }
    setBusy(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/locations/${location.id}`, {
        method: 'PATCH',
        body: JSON.stringify(locationBody(form)),
      })
      toast.success('Location saved.')
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the location.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete the “${location.name}” location?`)) return
    setBusy(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/locations/${location.id}`, { method: 'DELETE' })
      toast.success('Location deleted.')
      onDeleted()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the location.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3">
        <Badge variant={location.isPrimary ? 'default' : 'outline'}>
          {location.isPrimary ? 'Primary' : 'Branch'}
        </Badge>
      </div>
      <LocationFields value={form} onChange={setForm} />
      <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
        {dirty ? (
          <Button size="sm" onClick={save} disabled={busy}>
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
          aria-label={`Delete ${location.name}`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

function ServiceDialog({
  slug,
  open,
  locations,
  onOpenChange,
  onCreated,
}: {
  slug: string
  open: boolean
  locations: LocationRow[]
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<ServiceForm>({
    name: '',
    dayOfWeek: '0',
    startTime: '09:00',
    endTime: '',
    notes: '',
    locationId: '',
  })
  const [creating, setCreating] = useState(false)

  async function create() {
    if (form.name.trim().length < 2 || !form.startTime) {
      toast.error('Give the service a name and a start time.')
      return
    }
    setCreating(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/services`, {
        method: 'POST',
        body: JSON.stringify(serviceBody(form)),
      })
      toast.success('Service added.')
      onOpenChange(false)
      setForm({ name: '', dayOfWeek: '0', startTime: '09:00', endTime: '', notes: '', locationId: '' })
      onCreated()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not add the service.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a service time</DialogTitle>
          <DialogDescription>
            A weekly gathering — e.g. Sunday worship, midweek bible study, prayer meeting.
          </DialogDescription>
        </DialogHeader>
        <ServiceFields value={form} onChange={setForm} locations={locations} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Add service
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LocationDialog({
  slug,
  open,
  onOpenChange,
  onCreated,
}: {
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<LocationForm>({
    name: '',
    address: '',
    city: '',
    country: 'NG',
    mapUrl: '',
    isPrimary: false,
  })
  const [creating, setCreating] = useState(false)

  async function create() {
    if (form.name.trim().length < 2) {
      toast.error('Give the location a name.')
      return
    }
    setCreating(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/locations`, {
        method: 'POST',
        body: JSON.stringify(locationBody(form)),
      })
      toast.success('Location added.')
      onOpenChange(false)
      setForm({ name: '', address: '', city: '', country: 'NG', mapUrl: '', isPrimary: false })
      onCreated()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not add the location.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a location</DialogTitle>
          <DialogDescription>
            A campus or meeting place. The first location you add becomes the primary one.
          </DialogDescription>
        </DialogHeader>
        <LocationFields value={form} onChange={setForm} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Add location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
