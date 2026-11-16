import Link from 'next/link'
import {
  Activity,
  Church,
  ExternalLink,
  Files,
  Globe2,
  Images,
  Inbox,
  KeyRound,
  Mail,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { db } from '@/lib/db'
import { COUNTRIES } from '@/lib/format'
import {
  AdminChurchActions,
  AdminPasswordReset,
  AdminDomainActions,
  AdminPlanSelect,
  AdminDeleteChurch,
  AdminUserTools,
} from '@/components/dashboard/admin-console'
import { getDomainCapability, domainsOperable } from '@/lib/domains/capability'
import { isVercelConfigured } from '@/lib/domains/provider'

export const metadata = { title: 'Platform Administration' }

export default async function AdminPage() {
  const [churchesTotal, churchesPublished, users, submissionsNew, submissionsTotal, pages, mediaAssets] =
    await Promise.all([
      db.church.count(),
      db.church.count({ where: { isPublished: true } }),
      db.user.count(),
      db.formSubmission.count({ where: { status: 'NEW' } }),
      db.formSubmission.count(),
      db.websitePage.count(),
      db.mediaAsset.count(),
    ])

  const churches = await db.church.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { memberships: true, pages: true } } },
  })

  const domains = await db.churchDomain.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      domain: true,
      status: true,
      dnsStatus: true,
      sslStatus: true,
      isPrimary: true,
      provider: true,
      failureReason: true,
      lastCheckedAt: true,
      church: { select: { name: true, slug: true, plan: true } },
    },
  })
  const domainCapability = getDomainCapability()
  const vercelConfigured = isVercelConfigured()

  const stats = [
    { label: 'Churches', value: churchesTotal, icon: Church },
    { label: 'Published websites', value: churchesPublished, icon: Globe2 },
    { label: 'User accounts', value: users, icon: Users },
    { label: 'New enquiries', value: submissionsNew, icon: Inbox },
    { label: 'Total enquiries', value: submissionsTotal, icon: Mail },
    { label: 'Website pages', value: pages, icon: Files },
    { label: 'Media assets', value: mediaAssets, icon: Images },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every church on this OpenChurch deployment, with real counts straight from the database.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-background p-5">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-4.5" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Churches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Church className="size-4 text-muted-foreground" aria-hidden /> Churches
            <Badge variant="secondary">{churches.length}</Badge>
          </CardTitle>
          <CardDescription>
            Suspending a church blocks its dashboard APIs for every member until it is reactivated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {churches.length === 0 ? (
            <div className="py-12 text-center">
              <Church className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
              <p className="mt-3 font-medium">No churches yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Churches created through onboarding will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Church</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Members</TableHead>
                    <TableHead className="text-center">Pages</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {churches.map((church) => {
                    const countryName =
                      COUNTRIES.find((c) => c.code === church.country)?.name ?? church.country
                    const location = [church.city, countryName].filter(Boolean).join(', ')
                    return (
                      <TableRow key={church.id}>
                        <TableCell>
                          <p className="font-medium">{church.name}</p>
                          <Link
                            href={`/church/${church.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                          >
                            /church/{church.slug}
                            <ExternalLink className="size-3" aria-hidden />
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {location || '—'}
                        </TableCell>
                        <TableCell className="text-center">{church._count.memberships}</TableCell>
                        <TableCell className="text-center">{church._count.pages}</TableCell>
                        <TableCell>
                          <Badge variant={church.isPublished ? 'default' : 'secondary'}>
                            {church.isPublished ? 'Published' : 'Not published'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={church.status === 'SUSPENDED' ? 'destructive' : 'outline'}
                          >
                            {church.status === 'SUSPENDED' ? 'Suspended' : 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <AdminPlanSelect churchId={church.id} plan={church.plan} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(church.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <AdminChurchActions
                              churchId={church.id}
                              churchName={church.name}
                              status={church.status}
                            />
                            <AdminDeleteChurch churchId={church.id} slug={church.slug} name={church.name} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom domains & hosting integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="size-4 text-muted-foreground" aria-hidden /> Custom domains &amp; hosting
            <Badge variant="secondary">{domains.length}</Badge>
          </CardTitle>
          <CardDescription>
            One-time operator configuration for the whole deployment — churches then manage their own
            domains from Dashboard → Custom Domains.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              domainsOperable(domainCapability)
                ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40'
                : 'border-amber-200 bg-amber-50 dark:bg-amber-950/40'
            }`}
          >
            <p className="font-medium">
              {domainCapability.mode === 'managed-auto'
                ? 'Automated domain assignment: configured'
                : domainCapability.mode === 'self-hosted'
                  ? 'Self-hosted deployment: manual domain workflow'
                  : 'Managed custom domains: NOT available on this deployment'}
            </p>
            <p className="mt-1 text-muted-foreground">
              {domainCapability.summary}
              {!vercelConfigured && (
                <>
                  {' '}
                  To enable automated assignment on Vercel, set{' '}
                  <code className="rounded bg-muted px-1">VERCEL_TOKEN</code> and{' '}
                  <code className="rounded bg-muted px-1">VERCEL_PROJECT_ID</code> (optionally{' '}
                  <code className="rounded bg-muted px-1">VERCEL_TEAM_ID</code>) in the deployment
                  environment — see docs/DEPLOYMENT.md.
                </>
              )}
            </p>
          </div>
          {domains.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No custom domains connected yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Church</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>DNS</TableHead>
                    <TableHead>SSL</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <p className="font-medium">{d.domain}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.isPrimary ? 'primary' : d.provider ?? '—'}
                          {d.failureReason ? ` · ${d.failureReason.slice(0, 80)}` : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{d.church.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            d.status === 'ACTIVE'
                              ? 'default'
                              : d.status === 'SUSPENDED' || d.status === 'FAILED'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.dnsStatus ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.sslStatus ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <AdminDomainActions domainId={d.id} domain={d.domain} status={d.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password recovery (no email delivery on this instance) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" aria-hidden /> Reset a user&apos;s password
          </CardTitle>
          <CardDescription>
            This deployment does not send email, so password recovery works through you: enter the
            user&apos;s email and a new password. All of their signed-in sessions are revoked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminPasswordReset />
        </CardContent>
      </Card>

      {/* Account tools: data export & deletion (data-subject requests) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" aria-hidden /> Account tools
          </CardTitle>
          <CardDescription>
            Export a user&apos;s account data as JSON, or permanently delete an account that no
            longer owns any church — the mechanisms behind the privacy policy&apos;s export and
            deletion commitments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminUserTools />
        </CardContent>
      </Card>

      {/* Honest health note */}
      <Card className="border-dashed">
        <CardContent className="p-6 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Activity className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-medium">System health</p>
            <p className="mt-0.5 text-sm text-muted-foreground max-w-2xl">
              Database and storage are healthy when this page loads. Deeper monitoring (uptime, queue
              health) is deployment-specific — see docs/DEPLOYMENT.md.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
