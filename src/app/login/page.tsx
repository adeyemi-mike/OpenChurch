import type { Metadata } from 'next'
import LoginForm from './login-form'
import { demoModePresentation } from '@/lib/demo-mode'

export const metadata: Metadata = {
  title: 'Sign in — OpenChurch',
  description:
    'Sign in to manage your church website: pages, events, sermons, media and more.',
  robots: { index: false, follow: false },
}

/**
 * Server component. The decision to advertise demonstration accounts is
 * made here on the server for every request (DEMO_MODE); the client form
 * only receives the rendered payload. When demo mode is off, no
 * demonstration reference exists anywhere in the page HTML, and the login
 * API rejects demo accounts server-side.
 */
export default function LoginPage() {
  const demo = demoModePresentation()
  return <LoginForm demo={demo} />
}
