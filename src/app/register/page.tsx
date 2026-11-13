'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth/auth-shell'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import { Eye, EyeOff } from 'lucide-react'

export const TERMS_VERSION = '2026-11'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function clientValidate(): string | null {
    if (name.trim().length < 2) return 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Enter a valid email address.'
    }
    if (password.length < 8) return 'Use at least 8 characters.'
    if (!/[a-zA-Z]/.test(password)) return 'Include at least one letter in your password.'
    if (!/[0-9]/.test(password)) return 'Include at least one number in your password.'
    if (!accepted) return 'Please accept the Terms of Service and Privacy Policy.'
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
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          acceptedTermsVersion: TERMS_VERSION,
        }),
      })
      router.push('/onboarding')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.')
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start building your church website in minutes — free and open source."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <div role="alert" className="text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2.5 border border-destructive/20">
            {error}
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            required
            autoComplete="name"
            aria-describedby="name-hint"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rev. Daniel Adeyemi"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-invalid={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              aria-describedby="password-requirements"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              placeholder="At least 8 characters, with a number"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
          <p id="password-requirements" className="text-xs text-muted-foreground">
            Use at least 8 characters, including a letter and a number.
          </p>
        </div>
        <div className="flex items-start gap-2.5">
          <input
            id="accept-terms"
            name="accept-terms"
            type="checkbox"
            required
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-4 rounded border-input accent-primary"
          />
          <label htmlFor="accept-terms" className="text-sm leading-relaxed text-muted-foreground">
            I agree to the{' '}
            <Link href="/terms" className="text-foreground font-medium underline underline-offset-2 hover:text-primary" target="_blank">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-foreground font-medium underline underline-offset-2 hover:text-primary" target="_blank">
              Privacy Policy
            </Link>
            , including how my data is stored and protected.
          </label>
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}
