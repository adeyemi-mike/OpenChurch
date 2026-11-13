import Link from 'next/link'
import { History, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireChurchContext } from '@/lib/auth/guards'
import { can } from '@/lib/permissions'
import { db } from '@/lib/db'
import { fromJson } from '@/lib/serialization'

export const metadata = { title: 'Activity Log' }

const PAGE_SIZE = 25

// Human-readable labels for every audited action (fallback keeps future
// actions readable).
const AUDIT_LABELS: Record<string, string> = {
  'church.created': 'created the church',
  'church.updated': 'updated church details',
  'website.published': 'published the website',
  'website.unpublished': 'unpublished the website',
  'page.created': 'created a page',
  'page.updated': 'updated a page',
  'page.published': 'published a page',
  'page.deleted': 'deleted a page',
  'settings.updated': 'updated settings',
  'appearance.updated': 'updated the appearance',
  'navigation.updated': 'updated navigation',
  'ministry.created': 'added a ministry',
  'ministry.updated': 'updated a ministry',
  'ministry.deleted': 'deleted a ministry',
  'leader.created': 'added a leader',
  'leader.updated': 'updated a leader',
  'leader.deleted': 'deleted a leader',
  'event.created': 'created an event',
  'event.updated': 'updated an event',
  'event.deleted': 'deleted an event',
  'sermon.created': 'added a sermon',
  'sermon.updated': 'updated a sermon',
  'sermon.deleted': 'deleted a sermon',
  'service.updated': 'updated service times',
  'location.updated': 'updated locations',
  'media.uploaded': 'uploaded media',
  'media.updated': 'updated media details',
  'media.deleted': 'deleted media',
  'submission.updated': 'updated an enquiry',
  'submission.deleted': 'deleted an enquiry',
  'forms.updated': 'updated forms',
  'giving.updated': 'updated giving settings',
  'member.role_changed': 'changed a member role',
  'member.added': 'added a member',
  'member.removed': 'removed a member',
  'user.registered': 'joined the platform',
  'user.login': 'signed in',
  'platform.church_suspended': 'suspended this church (platform admin)',
  'platform.church_activated': 'reactivated this church (platform admin)',
}

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page: pageParam } = await searchParams
  const ctx = await requireChurchContext(slug)

  if (!can(ctx.role, 'activity:view')) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <ShieldAlert className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
        <h1 className="mt-3 font-semibold text-lg">Activity log is admin-only</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
          The audit trail is visible to owners and administrators of this church.
        </p>
      </div>
    )
  }

  const parsed = Number.parseInt(pageParam ?? '1', 10)
  const requestedPage = Number.isFinite(parsed) && parsed > 1 ? parsed : 1

  const total = await db.auditLog.count({ where: { churchId: ctx.church.id } })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)

  const entries = await db.auditLog.findMany({
    where: { churchId: ctx.church.id },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  const prevPage = page > 1 ? page - 1 : null
  const nextPage = page < totalPages ? page + 1 : null

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every administrative action in this church — who did what, and when. {total}{' '}
          {total === 1 ? 'entry' : 'entries'} recorded.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden /> Audit trail
          </CardTitle>
          <CardDescription>
            Metadata stays minimal by design — submission contents and personal data are never logged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="py-12 text-center">
              <History className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
              <p className="mt-3 font-medium">No activity recorded yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Actions like publishing pages, editing content or changing roles will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {entries.map((entry) => {
                const meta = fromJson<Record<string, unknown>>(entry.metadata, {})
                return (
                  <li key={entry.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-medium">{entry.actorEmail ?? 'Someone'}</span>{' '}
                        <span className="text-muted-foreground">
                          {AUDIT_LABELS[entry.action] ?? entry.action.replace(/[._]/g, ' ')}
                          {typeof meta.title === 'string' && meta.title ? ` (${meta.title})` : ''}
                          {typeof meta.fileName === 'string' && meta.fileName ? ` (${meta.fileName})` : ''}
                          {typeof meta.category === 'string' && meta.category ? ` (${meta.category})` : ''}
                          {typeof meta.name === 'string' && meta.name ? ` (${meta.name})` : ''}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              {prevPage !== null ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/console/${slug}/activity?page=${prevPage}`} aria-label="Previous page">
                    Previous
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              )}
              <p className="text-sm text-muted-foreground">
                Page <span className="font-medium text-foreground">{page}</span> of {totalPages}
              </p>
              {nextPage !== null ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/console/${slug}/activity?page=${nextPage}`} aria-label="Next page">
                    Next
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
