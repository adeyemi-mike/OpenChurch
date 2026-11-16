import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Church, Plus, ArrowRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser, getUserMemberships } from '@/lib/auth/guards'

export const metadata = { title: 'Your churches', robots: { index: false } }

export default async function DashboardPickerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const user = await requireUser()
  const memberships = await getUserMemberships(user.id)

  // One church? Go straight to it.
  if (memberships.length === 1 && !error) {
    redirect(`/console/${memberships[0].church.slug}`)
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
            <span className="grid place-items-center size-8 rounded-lg bg-primary text-primary-foreground">
              <Church className="size-4" aria-hidden />
            </span>
            OpenChurch
          </Link>
          {user.isPlatformAdmin ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">Platform admin</Link>
            </Button>
          ) : null}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your churches</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Signed in as {user.name} ({user.email})
            </p>
          </div>
          <Button asChild>
            <Link href="/onboarding">
              <Plus className="size-4" aria-hidden /> Add a church
            </Link>
          </Button>
        </div>

        {error === 'suspended' ? (
          <div role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm">
            One of your churches has been suspended by the platform administrator. Contact the platform owner for details.
          </div>
        ) : null}

        {memberships.length === 0 ? (
          <Card className="mt-8">
            <CardContent className="p-10 text-center">
              <span className="mx-auto grid place-items-center size-12 rounded-2xl bg-primary/10 text-primary">
                <Church className="size-6" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold text-lg">No churches yet</h2>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">
                Create your first church website with the guided setup — it takes about five minutes.
              </p>
              <Button asChild className="mt-6">
                <Link href="/onboarding">
                  Start the setup wizard <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {memberships.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/console/${m.church.slug}`}
                  className="group flex flex-col rounded-2xl border bg-background p-5 transition-shadow hover:shadow-md focus-visible:ring-2 ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{m.church.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">/church/{m.church.slug}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2.5 py-1">
                      {m.role === 'OWNER' ? 'Owner' : m.role === 'ADMIN' ? 'Admin' : m.role === 'EDITOR' ? 'Editor' : 'Author'}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className={`size-1.5 rounded-full ${m.church.isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        aria-hidden
                      />
                      {m.church.isPublished ? 'Published' : 'Draft'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-primary font-medium group-hover:underline">
                      Open dashboard <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={`/onboarding`}
                className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Plus className="size-6" aria-hidden />
                <span className="mt-2 text-sm font-medium">Create another church</span>
              </Link>
            </li>
          </ul>
        )}

        <p className="mt-8 text-sm text-muted-foreground">
          Want to see a finished example first?{' '}
          <Link href="/church/grace-community" target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">
            Visit the demo church <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </p>
      </main>
    </div>
  )
}
