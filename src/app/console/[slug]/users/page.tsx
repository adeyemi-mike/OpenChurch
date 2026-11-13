import { ShieldAlert } from 'lucide-react'
import { requireChurchContext } from '@/lib/auth/guards'
import { can } from '@/lib/permissions'
import { UsersManager } from '@/components/dashboard/users-manager'

export const metadata = { title: 'Users & Roles' }

export default async function UsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)

  if (!can(ctx.role, 'church:manage_users')) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <ShieldAlert className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
        <h1 className="mt-3 font-semibold text-lg">Only owners manage users</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
          Adding members and changing roles is reserved for the church owner in this version.
        </p>
      </div>
    )
  }

  return <UsersManager slug={slug} role={ctx.role} viewerEmail={ctx.user.email} />
}
