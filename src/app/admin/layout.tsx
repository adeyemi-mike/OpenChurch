import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import { OpenChurchMark } from '@/components/platform/brand'
import { Button } from '@/components/ui/button'
import { getSessionUser } from '@/lib/auth/session'
import { PlatformSignOutButton } from '@/components/dashboard/admin-console'

export const metadata: Metadata = {
  title: 'Platform Administration',
  robots: { index: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.isPlatformAdmin) redirect('/console')

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-2.5 font-semibold"
            aria-label="OpenChurch platform administration home"
          >
            <OpenChurchMark className="size-8 text-primary" />
            <span className="truncate">
              <span className="font-bold text-primary">Open</span>Church Platform Administration
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/console">
                <LayoutDashboard className="size-4" aria-hidden /> Back to dashboard
              </Link>
            </Button>
            <PlatformSignOutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">{children}</main>

      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 text-xs text-muted-foreground">
          OpenChurch — open-source church website platform. Platform actions are audited.
        </div>
      </footer>
    </div>
  )
}
