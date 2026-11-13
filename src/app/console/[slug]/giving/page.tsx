import { ShieldAlert } from 'lucide-react'
import { requireChurchContext } from '@/lib/auth/guards'
import { can } from '@/lib/permissions'
import { GivingManager } from '@/components/dashboard/giving-manager'

export const metadata = { title: 'Giving' }

export default async function GivingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)

  if (!can(ctx.role, 'giving:manage')) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <ShieldAlert className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
        <h1 className="mt-3 font-semibold text-lg">Giving is owner-managed</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
          Only the church owner can change giving settings in this version. Ask an owner if something
          needs to change.
        </p>
      </div>
    )
  }

  return <GivingManager slug={slug} role={ctx.role} />
}
