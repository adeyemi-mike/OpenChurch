import { requireChurchContext } from '@/lib/auth/guards'
import { MediaManager } from '@/components/dashboard/media-manager'

export const metadata = { title: 'Media Library' }

export default async function MediaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  return <MediaManager slug={slug} role={ctx.role} />
}
