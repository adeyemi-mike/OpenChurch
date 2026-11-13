import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth/guards'
import { OnboardingWizard } from '@/components/onboarding/wizard'
import { Church } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Set up your church website',
  robots: { index: false },
}

export default async function OnboardingPage() {
  const user = await requireUser()
  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
            <span className="grid place-items-center size-8 rounded-lg bg-primary text-primary-foreground">
              <Church className="size-4" aria-hidden />
            </span>
            OpenChurch
          </Link>
          <span className="text-sm text-muted-foreground">Onboarding — your progress is saved automatically</span>
        </div>
      </header>
      <main className="flex-1 pb-16">
        <OnboardingWizard userName={user.name} />
      </main>
    </div>
  )
}
