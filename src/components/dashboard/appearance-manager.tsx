'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Save, Loader2, Megaphone, ImageIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ColorPicker } from '@/components/onboarding/color-picker'
import { MediaPicker } from '@/components/builder/media-picker'
import { THEMES } from '@/lib/themes/registry'
import { FONTS } from '@/lib/themes/fonts'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import { cn } from '@/lib/utils'

export type SettingsDto = {
  id: string
  themeKey: string
  primaryColor: string
  secondaryColor: string
  fontKey: string
  logoUrl: string | null
  heroImageUrl: string | null
  footerText: string | null
  copyrightLine: string | null
  socialFacebook: string | null
  socialInstagram: string | null
  socialYoutube: string | null
  socialX: string | null
  socialTiktok: string | null
  whatsappNumber: string | null
  defaultSeoTitle: string | null
  defaultSeoDescription: string | null
  mapEmbedUrl: string | null
  announcementText: string | null
  announcementEnabled: boolean
}

export function AppearanceManager({ slug, initial }: { slug: string; initial: SettingsDto }) {
  const router = useRouter()
  const [settings, setSettings] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [pickerFor, setPickerFor] = useState<'logoUrl' | 'heroImageUrl' | null>(null)

  function set<K extends keyof SettingsDto>(key: K, value: SettingsDto[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          themeKey: settings.themeKey,
          primaryColor: settings.primaryColor,
          secondaryColor: settings.secondaryColor,
          fontKey: settings.fontKey,
          logoUrl: settings.logoUrl ?? '',
          heroImageUrl: settings.heroImageUrl ?? '',
          footerText: settings.footerText ?? '',
          copyrightLine: settings.copyrightLine ?? '',
          socialFacebook: settings.socialFacebook ?? '',
          socialInstagram: settings.socialInstagram ?? '',
          socialYoutube: settings.socialYoutube ?? '',
          socialX: settings.socialX ?? '',
          socialTiktok: settings.socialTiktok ?? '',
          whatsappNumber: settings.whatsappNumber ?? '',
          announcementText: settings.announcementText ?? '',
          announcementEnabled: settings.announcementEnabled,
        }),
      })
      toast.success('Appearance saved — your website already reflects the change.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the appearance.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your theme, colours, typography and imagery. Changes apply to the whole website.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Save changes
        </Button>
      </div>

      {/* Live mini preview */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <div
            className="px-6 py-8 text-white"
            style={{
              background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})`,
            }}
          >
            <p
              className="text-xs uppercase tracking-[0.2em] opacity-75"
              style={{ fontFamily: `var(${FONTS.find((f) => f.key === settings.fontKey)?.headingVar ?? '--font-geist-sans'})` }}
            >
              Live preview
            </p>
            <p
              className="mt-2 text-3xl font-semibold"
              style={{ fontFamily: `var(${FONTS.find((f) => f.key === settings.fontKey)?.headingVar ?? '--font-geist-sans'})` }}
            >
              Welcome home.
            </p>
            <span
              className="inline-block mt-4 rounded-full px-5 py-2.5 text-sm font-semibold"
              style={{ background: settings.secondaryColor, color: '#fff', borderRadius: THEMES.find((t) => t.key === settings.themeKey)?.tokens.buttons === 'pill' ? 999 : 8 }}
            >
              Plan your visit
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>A starting point — colours and fonts below always override it.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Themes">
            {THEMES.map((theme) => (
              <button
                key={theme.key}
                type="button"
                role="radio"
                aria-checked={settings.themeKey === theme.key}
                onClick={() => set('themeKey', theme.key)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors hover:border-primary/50',
                  settings.themeKey === theme.key && 'border-primary ring-1 ring-ring'
                )}
              >
                <p className="font-semibold text-sm">{theme.name}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-snug">{theme.tagline}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle>Brand colours & typography</CardTitle>
          <CardDescription>Used across every page of your website.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <ColorPicker
              label="Primary colour"
              value={settings.primaryColor}
              onChange={(hex) => set('primaryColor', hex)}
            />
            <ColorPicker
              label="Secondary colour"
              value={settings.secondaryColor}
              onChange={(hex) => set('secondaryColor', hex)}
            />
          </div>
          <div className="space-y-2">
            <Label>Typography</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              {FONTS.map((font) => (
                <button
                  key={font.key}
                  type="button"
                  onClick={() => set('fontKey', font.key)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors hover:border-primary/50',
                    settings.fontKey === font.key && 'border-primary ring-1 ring-ring'
                  )}
                  aria-pressed={settings.fontKey === font.key}
                >
                  <p className="font-semibold text-lg" style={{ fontFamily: `var(${font.headingVar})` }}>
                    The grace of God
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{font.label}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo & hero */}
      <Card>
        <CardHeader>
          <CardTitle>Logo & hero image</CardTitle>
          <CardDescription>Upload from your media library or paste a URL.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            {settings.logoUrl ? (
               
              <img src={settings.logoUrl} alt="Church logo" className="size-20 rounded-xl border object-contain p-1" />
            ) : (
              <div className="size-20 rounded-xl border grid place-items-center text-muted-foreground/50">
                <ImageIcon className="size-6" aria-hidden />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <Button variant="outline" size="sm" onClick={() => setPickerFor('logoUrl')}>
                Choose logo
              </Button>
              <Input
                placeholder="Logo URL"
                value={settings.logoUrl ?? ''}
                onChange={(e) => set('logoUrl', e.target.value)}
                className="text-xs"
                aria-label="Logo URL"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {settings.heroImageUrl ? (
               
              <img src={settings.heroImageUrl} alt="Hero image" className="h-20 w-36 rounded-xl border object-cover" />
            ) : (
              <div className="h-20 w-36 rounded-xl border grid place-items-center text-muted-foreground/50">
                <ImageIcon className="size-6" aria-hidden />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <Button variant="outline" size="sm" onClick={() => setPickerFor('heroImageUrl')}>
                Choose hero image
              </Button>
              <Input
                placeholder="Hero image URL (used by hero sections without their own image)"
                value={settings.heroImageUrl ?? ''}
                onChange={(e) => set('heroImageUrl', e.target.value)}
                className="text-xs"
                aria-label="Hero image URL"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Announcement bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-4 text-muted-foreground" aria-hidden /> Announcement bar
          </CardTitle>
          <CardDescription>A short banner shown at the very top of every page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-3.5 py-3">
            <Label htmlFor="announce-enabled" className="mb-0">Show announcement bar</Label>
            <Switch
              id="announce-enabled"
              checked={settings.announcementEnabled}
              onCheckedChange={(v) => set('announcementEnabled', v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="announce-text">Announcement text</Label>
            <Input
              id="announce-text"
              value={settings.announcementText ?? ''}
              onChange={(e) => set('announcementText', e.target.value)}
              placeholder="e.g. Youth Weekend Away — registrations close Sunday!"
              maxLength={300}
            />
          </div>
        </CardContent>
      </Card>

      {/* Footer & socials */}
      <Card>
        <CardHeader>
          <CardTitle>Footer & social links</CardTitle>
          <CardDescription>Shown at the bottom of every page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="footer-text">About text</Label>
            <Textarea
              id="footer-text"
              rows={3}
              value={settings.footerText ?? ''}
              onChange={(e) => set('footerText', e.target.value)}
              placeholder="A sentence about your church"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="copyright">Copyright line</Label>
            <Input
              id="copyright"
              value={settings.copyrightLine ?? ''}
              onChange={(e) => set('copyrightLine', e.target.value)}
              placeholder="© Your Church Name"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {(
              [
                ['socialFacebook', 'Facebook URL'],
                ['socialInstagram', 'Instagram URL'],
                ['socialYoutube', 'YouTube URL'],
                ['socialX', 'X (Twitter) URL'],
                ['socialTiktok', 'TikTok URL'],
                ['whatsappNumber', 'WhatsApp number (e.g. +2348012345678)'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`s-${key}`}>{label}</Label>
                <Input
                  id={`s-${key}`}
                  value={settings[key] ?? ''}
                  onChange={(e) => set(key, e.target.value as SettingsDto[typeof key])}
                  placeholder="Optional"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Save changes
        </Button>
      </div>

      {pickerFor ? (
        <MediaPicker
          open
          slug={slug}
          onClose={() => setPickerFor(null)}
          onSelect={(url) => set(pickerFor, url)}
        />
      ) : null}
    </div>
  )
}
