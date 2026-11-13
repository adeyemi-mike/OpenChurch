import { requireChurchContext } from '@/lib/auth/guards'
import { NavigationManager } from '@/components/dashboard/navigation-manager'

export const metadata = { title: 'Navigation' }

export default async function NavigationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  return <NavigationManager slug={slug} role={ctx.role} />
}
