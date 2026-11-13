import { requireChurchContext } from '@/lib/auth/guards'
import { LeadersManager } from '@/components/dashboard/leaders-manager'

export const metadata = { title: 'Leadership' }

export default async function LeadershipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  return <LeadersManager slug={slug} role={ctx.role} />
}
