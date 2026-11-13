import { requireChurchContext } from '@/lib/auth/guards'
import { PagesManager } from '@/components/dashboard/pages-manager'

export const metadata = { title: 'Website Pages' }

export default async function PagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  return <PagesManager slug={slug} role={ctx.role} />
}
