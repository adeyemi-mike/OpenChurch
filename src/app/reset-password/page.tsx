'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth/auth-shell'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  const tokenMissing = !token

  function clientValidate(): string | null {
    if (password.length < 8) return 'Use at least 8 characters.'
    if (!/[a-zA-Z]/.test(password)) return 'Include at least one letter.'
    if (!/[0-9]/.test(password)) return 'Include at least one number.'
    if (password !== confirm) return 'The two passwords do not match.'
    return null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const problem = clientValidate()
    if (problem) {
      setError(problem)
      return
    }
    setPending(true)
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.')
      setPending(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-10 text-green-600" aria-hidden />
        <p className="font-medium">Your password has been changed.</p>
        <p className="text-sm text-muted-foreground">
          All other signed-in sessions were signed out for safety. Redirecting you to sign in…
        </p>
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    )
  }

  if (tokenMissing) {
    return (
      <div className="space-y-4">
        <div role="alert" className="text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2.5 border border-destructive/20">
          This password reset link is missing its token. Request a fresh link and open it directly.
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
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
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <Input
            id="password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          At least 8 characters, with at least one letter and one number.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        <KeyRound className="size-4" aria-hidden />
        {pending ? 'Updating…' : 'Set new password'}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something strong — you will only need to do this once."
      footer={
        <>
          Remembered your password after all?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
