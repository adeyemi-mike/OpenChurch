import type { Metadata } from 'next'
import { requireChurchContext } from '@/lib/auth/guards'
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
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
