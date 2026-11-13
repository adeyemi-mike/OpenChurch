import { requireChurchContext } from '@/lib/auth/guards'
import { EventsManager } from '@/components/dashboard/events-manager'

export const metadata = { title: 'Events' }

export default async function EventsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  return <EventsManager slug={slug} role={ctx.role} />
}
