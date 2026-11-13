'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import { MailCheck } from 'lucide-react'

/**
 * Reset-link request form. The API responds generically (it never reveals
 * whether the email exists), and so does this success state — but because
 * this page only renders the form when SMTP is configured, no success
 * message ever falsely claims an email was sent by an unconfigured system.
 */
export function ResetRequestForm() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-green-600/30 bg-green-50 dark:bg-green-950/30 p-4">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-green-700 dark:text-green-400" aria-hidden />
        <div className="text-sm leading-relaxed">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-muted-foreground">
            If an account exists for that address, a single-use reset link is on its
            way (check your spam folder too). The link expires after one hour.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <div role="alert" className="text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2.5 border border-destructive/20">
          {error}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email address</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a reset link'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Changed your mind?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
