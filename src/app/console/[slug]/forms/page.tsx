import { requireChurchContext } from '@/lib/auth/guards'
import { EnquiriesManager } from '@/components/dashboard/enquiries-manager'

export const metadata = { title: 'Forms & Enquiries' }

export default async function FormsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  return <EnquiriesManager slug={slug} role={ctx.role} />
}
