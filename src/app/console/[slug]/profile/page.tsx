import { requireChurchContext } from '@/lib/auth/guards'
import { ProfileManager } from '@/components/dashboard/profile-manager'
import { PasswordCard } from '@/components/dashboard/password-card'

export const metadata = { title: 'Church Profile' }

export default async function ChurchProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  return (
    <>
      <ProfileManager slug={slug} role={ctx.role} />
      <PasswordCard />
    </>
  )
}
