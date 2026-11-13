'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Database,
  ExternalLink,
  Globe2,
  Loader2,
  Save,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { WebsitePublishButton } from '@/components/dashboard/publish-button'
import { apiFetch, ApiClientError } from '@/lib/client/api'

export function WebsiteSettings({
  slug,
  isPublished,
  initial,
}: {
  slug: string
  isPublished: boolean
  initial: {
    defaultSeoTitle: string
    defaultSeoDescription: string
    mapEmbedUrl: string
  }
}) {
  const [seoTitle, setSeoTitle] = useState(initial.defaultSeoTitle)
  const [seoDescription, setSeoDescription] = useState(initial.defaultSeoDescription)
  const [mapEmbedUrl, setMapEmbedUrl] = useState(initial.mapEmbedUrl)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          defaultSeoTitle: seoTitle.trim(),
          defaultSeoDescription: seoDescription.trim(),
          mapEmbedUrl: mapEmbedUrl.trim(),
        }),
      })
      toast.success('Search engine defaults saved.')
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Website settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Publishing, search engine defaults and where your website lives.
        </p>
      </div>

      {/* Website status */}
      <Card>
        <CardHeader>
          <CardTitle>Website status</CardTitle>
          <CardDescription>
            Publishing makes your website visible to the world; unpublishing shows visitors a holding
            page instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                isPublished ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
            >
              <span
                className={`size-2 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`}
                aria-hidden
              />
              {isPublished ? 'Your website is live' : 'Your website is not published'}
            </span>
            <WebsitePublishButton slug={slug} isPublished={isPublished} />
            <Button asChild variant="ghost">
              <Link href={`/church/${slug}`} target="_blank">
                <ExternalLink className="size-4" aria-hidden /> Open public website
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {isPublished
              ? 'Visitors can browse your published pages right now.'
              : 'Visitors currently see a simple “not yet published” holding page — your content stays safe in the dashboard.'}
          </p>
        </CardContent>
      </Card>

      {/* Search engine defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" aria-hidden /> Search engine defaults
          </CardTitle>
          <CardDescription>
            Used when a page has no SEO settings of its own — keep them under the limits so search
            results don’t get cut off.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo-title">Default page title</Label>
              <span
                className={`text-xs ${seoTitle.length > 70 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                aria-live="polite"
              >
                {seoTitle.length}/70
              </span>
            </div>
            <Input
              id="seo-title"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={`${slug} — page title`}
              maxLength={70}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo-description">Default page description</Label>
              <span
                className={`text-xs ${seoDescription.length > 200 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                aria-live="polite"
              >
                {seoDescription.length}/200
              </span>
            </div>
            <Textarea
              id="seo-description"
              rows={3}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="A sentence or two about your church, shown under your name in search results."
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="map-url">Map embed URL</Label>
            <Input
              id="map-url"
              value={mapEmbedUrl}
              onChange={(e) => setMapEmbedUrl(e.target.value)}
              placeholder="https://www.google.com/maps/embed?pb=…"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Google Maps embed URL — search “Google Maps embed”, choose your place, copy the src URL.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              Save defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Your address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="size-4 text-muted-foreground" aria-hidden /> Your address
          </CardTitle>
          <CardDescription>Where people find your church website today.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-xl border bg-muted/40 px-4 py-3 font-mono text-sm break-all">
            /church/{slug}
          </p>
          <p className="text-sm text-muted-foreground">
            Custom domains (yourchurch.org) and subdomain routing are designed for self-hosted
            deployments — see docs/DEPLOYMENT.md in the repository. In this hosted demo, your site is
            served from the path above.
          </p>
        </CardContent>
      </Card>

      {/* Data & ownership */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" aria-hidden /> Data &amp; ownership
          </CardTitle>
          <CardDescription>Your content belongs to your church, not to us.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your content is yours. Export via the open-source codebase or contact your platform
            administrator. Because OpenChurch is open source, you can self-host the exact same stack —
            the repository README and docs/DATABASE.md describe the schema and export options.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
