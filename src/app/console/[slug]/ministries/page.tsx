import { requireChurchContext } from '@/lib/auth/guards'
import { MinistriesManager } from '@/components/dashboard/ministries-manager'

export const metadata = { title: 'Ministries' }

export default async function MinistriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  return <MinistriesManager slug={slug} role={ctx.role} />
}
