import { requireChurchContext } from '@/lib/auth/guards'
import { SermonsManager } from '@/components/dashboard/sermons-manager'

export const metadata = { title: 'Sermons' }

export default async function SermonsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  return <SermonsManager slug={slug} role={ctx.role} />
}
