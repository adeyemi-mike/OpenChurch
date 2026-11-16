import type { Metadata } from 'next'
import { FlaskConical } from 'lucide-react'
import { requireChurchContext } from '@/lib/auth/guards'
import { isDemoModeEnabled } from '@/lib/demo-mode'
import { DashboardSidebar } from '@/components/dashboard/sidebar'

export const metadata: Metadata = {
  robots: { index: false },
}

export default async function ChurchDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  const showDemoBanner = ctx.church.isDemo && isDemoModeEnabled()

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-muted/30">
      <DashboardSidebar
        slug={ctx.church.slug}
        churchName={ctx.church.name}
        role={ctx.role}
        isPublished={ctx.church.isPublished}
        userName={ctx.user.name}
        userEmail={ctx.user.email}
      />
      <main className="flex-1 min-w-0">
        {showDemoBanner && (
          <div
            className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
            role="note"
          >
            <FlaskConical className="size-3.5 shrink-0" aria-hidden />
            Demonstration church — all content and enquiries here are fictional test data.
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
