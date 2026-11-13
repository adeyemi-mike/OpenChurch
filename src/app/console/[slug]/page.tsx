import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Files,
  CalendarDays,
  BookOpen,
  HeartHandshake,
  Inbox,
  ArrowRight,
  ExternalLink,
  Plus,
  BarChart3,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { requireChurchContext } from '@/lib/auth/guards'
import { db } from '@/lib/db'
import { can } from '@/lib/permissions'
import { fromJson } from '@/lib/serialization'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { WebsitePublishButton } from '@/components/dashboard/publish-button'

export const metadata = { title: 'Overview' }

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
  'media.uploaded': 'uploaded media',
  'media.updated': 'updated media details',
  'media.deleted': 'deleted media',
  'submission.updated': 'updated an enquiry',
  'giving.updated': 'updated giving settings',
  'member.role_changed': 'changed a member role',
  'member.added': 'added a member',
  'member.removed': 'removed a member',
  'user.registered': 'joined the platform',
  'user.login': 'signed in',
}

export default async function OverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)

  const [pageCount, upcomingEvents, sermonCount, ministryCount, newEnquiries, recentEnquiries, recentActivity] =
    await Promise.all([
      db.websitePage.count({ where: { churchId: ctx.church.id, status: 'PUBLISHED' } }),
      db.event.count({ where: { churchId: ctx.church.id, status: 'PUBLISHED', startsAt: { gte: new Date() } } }),
      db.sermon.count({ where: { churchId: ctx.church.id, status: 'PUBLISHED' } }),
      db.ministry.count({ where: { churchId: ctx.church.id, status: 'PUBLISHED' } }),
      db.formSubmission.count({ where: { churchId: ctx.church.id, status: 'NEW' } }),
      db.formSubmission.findMany({
        where: { churchId: ctx.church.id, ...(can(ctx.role, 'enquiries:view_sensitive') ? {} : { isSensitive: false }) },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.auditLog.findMany({
        where: { churchId: ctx.church.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ])

  const canPublish = can(ctx.role, 'website:publish')
  const canViewEnquiries = can(ctx.role, 'enquiries:view')

  const stats = [
    { label: 'Published pages', value: pageCount, icon: Files, href: `/console/${slug}/pages` },
    { label: 'Upcoming events', value: upcomingEvents, icon: CalendarDays, href: `/console/${slug}/events` },
    { label: 'Published sermons', value: sermonCount, icon: BookOpen, href: `/console/${slug}/sermons` },
    { label: 'Ministries', value: ministryCount, icon: HeartHandshake, href: `/console/${slug}/ministries` },
  ]

  return (
    <>
      <DashboardPageHeader
        title={`Welcome back, ${ctx.user.name.split(' ')[0]}`}
        description={`You are ${ctx.role === 'OWNER' ? 'the owner' : ctx.role === 'ADMIN' ? 'an administrator' : ctx.role === 'EDITOR' ? 'an editor' : 'an author'} of ${ctx.church.name}.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/church/${slug}`} target="_blank">
                <ExternalLink className="size-4" aria-hidden /> View website
              </Link>
            </Button>
            {canPublish ? (
              <WebsitePublishButton slug={slug} isPublished={ctx.church.isPublished} />
            ) : null}
          </>
        }
      />

      {/* Website status banner */}
      {!ctx.church.isPublished ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-semibold">Your website is not published yet.</span>{' '}
            <span className="text-amber-800">Visitors currently see a holding page. Review your pages, then publish when ready.</span>
          </p>
          {canPublish ? <WebsitePublishButton slug={slug} isPublished={false} size="sm" /> : null}
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border bg-background p-5 transition-shadow hover:shadow-md focus-visible:ring-2 ring-ring"
          >
            <div className="flex items-center justify-between">
              <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-4.5" aria-hidden />
              </span>
              <ArrowRight className="size-4 text-muted-foreground/50" aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent enquiries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="size-4 text-muted-foreground" aria-hidden /> Recent enquiries
              {newEnquiries > 0 ? (
                <Badge className="bg-primary text-primary-foreground">{newEnquiries} new</Badge>
              ) : null}
            </CardTitle>
            {canViewEnquiries ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/console/${slug}/forms`}>View all</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {!canViewEnquiries ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                You do not have permission to view enquiries.
              </p>
            ) : recentEnquiries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No enquiries yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  When people send messages through your website contact form, they appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {recentEnquiries.map((s) => (
                  <li key={s.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.isSensitive ? (
                          <span className="text-muted-foreground" title="Sensitive — visible to owners and admins only">
                            🔒 Sensitive request
                          </span>
                        ) : (
                          s.subject || s.type
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.isSensitive ? 'Prayer / counselling' : s.name} · {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={s.status === 'NEW' ? 'default' : s.status === 'RESOLVED' ? 'secondary' : 'outline'}>
                      {s.status === 'NEW' ? 'New' : s.status === 'IN_PROGRESS' ? 'In progress' : s.status === 'RESOLVED' ? 'Resolved' : 'Archived'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" aria-hidden /> Recent activity
            </CardTitle>
            {can(ctx.role, 'activity:view') ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/console/${slug}/activity`}>View all</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((a) => {
                  const meta = fromJson<Record<string, unknown>>(a.metadata, {})
                  return (
                    <li key={a.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                      <p className="leading-snug">
                        <span className="font-medium">{a.actorEmail ?? 'Someone'}</span>{' '}
                        <span className="text-muted-foreground">
                          {AUDIT_LABELS[a.action] ?? a.action.replace(/[._]/g, ' ')}
                          {typeof meta.fileName === 'string' ? ` (${meta.fileName})` : ''}
                          {typeof meta.title === 'string' ? ` (${meta.title})` : ''}
                        </span>
                        <span className="block text-xs text-muted-foreground/60 mt-0.5">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics — honest prompt, no fabricated numbers */}
      <Card className="mt-6 border-dashed">
        <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center size-10 rounded-xl bg-muted text-muted-foreground shrink-0">
              <BarChart3 className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium">Visitor analytics are not configured</p>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
                OpenChurch does not fabricate traffic numbers. Connect a privacy-respecting analytics
                provider to see real visitors — until then, this space stays empty.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" disabled aria-disabled>
            Setup analytics
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
