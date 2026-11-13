'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Loader2, Files, ExternalLink, Pencil, Trash2, FileText, Home, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { apiFetch, ApiClientError } from '@/lib/client/api'
import type { ChurchRole } from '@/lib/permissions'

type PageRow = {
  id: string
  title: string
  slug: string
  isHomePage: boolean
  status: string
  publishedAt: string | null
  updatedAt: string
}

export function PagesManager({ slug, role }: { slug: string; role: ChurchRole }) {
  const router = useRouter()
  const [pages, setPages] = useState<PageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [creating, setCreating] = useState(false)

  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'EDITOR'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ pages: PageRow[] }>(`/api/dashboard/${slug}/pages`)
      setPages(res.pages)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load pages.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  async function createPage() {
    if (newTitle.trim().length < 1) {
      toast.error('Give the page a title first.')
      return
    }
    setCreating(true)
    try {
      const page = await apiFetch<{ id: string }>(`/api/dashboard/${slug}/pages`, {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), slug: newSlug.trim() || undefined }),
      })
      toast.success('Page created — opening the builder.')
      router.push(`/console/${slug}/pages/${page.id}`)
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not create the page.')
      setCreating(false)
    }
  }

  async function deletePage(page: PageRow) {
    if (!confirm(`Delete “${page.title}”? This cannot be undone.`)) return
    try {
      await apiFetch(`/api/dashboard/${slug}/pages/${page.id}`, { method: 'DELETE' })
      toast.success('Page deleted.')
      load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the page.')
    }
  }

  const filtered = pages.filter(
    (p) =>
      !query ||
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.slug.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Website pages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build pages from sections — every change is drafted until you publish.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden /> New page
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Search pages…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search pages"
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-muted-foreground" role="status">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Files className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">{pages.length === 0 ? 'No pages yet' : 'No pages match your search'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pages.length === 0 ? 'Create your first page to get started.' : 'Try a different search term.'}
          </p>
          {pages.length === 0 && canManage ? (
            <Button className="mt-5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden /> New page
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((page) => (
            <li key={page.id} className="rounded-2xl border bg-background p-4 sm:p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary shrink-0" aria-hidden>
                    {page.isHomePage ? <Home className="size-5" /> : <FileText className="size-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{page.title}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {page.isHomePage ? '/' : `/${page.slug}`}
                    </p>
                  </div>
                </div>
                <Badge variant={page.status === 'PUBLISHED' ? 'default' : page.status === 'DRAFT' ? 'secondary' : 'outline'}>
                  {page.status === 'PUBLISHED' ? 'Published' : page.status === 'DRAFT' ? 'Draft' : 'Archived'}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t">
                <Link
                  href={`/console/${slug}/pages/${page.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <Pencil className="size-3.5" aria-hidden /> Edit in builder
                </Link>
                <div className="flex items-center gap-1">
                  {page.status === 'PUBLISHED' ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/church/${slug}${page.isHomePage ? '' : `/${page.slug}`}`} target="_blank">
                        <ExternalLink className="size-3.5" aria-hidden /> View live
                      </Link>
                    </Button>
                  ) : null}
                  {canManage && !page.isHomePage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deletePage(page)}
                      aria-label={`Delete ${page.title}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new page</DialogTitle>
            <DialogDescription>
              Give it a title — you can edit everything else in the builder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="np-title">Page title *</Label>
              <Input
                id="np-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Children's Church"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-slug">Path (optional)</Label>
              <div className="flex items-center rounded-md border">
                <span className="pl-3 pr-1 text-sm text-muted-foreground select-none">/</span>
                <Input
                  id="np-slug"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder={newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'auto'}
                  className="border-0 focus-visible:ring-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The web address of the page, e.g. /childrens-church
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createPage} disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              Create page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
