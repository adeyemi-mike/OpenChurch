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

export type DemoPanel = {
  accounts: { email: string; label: string }[]
  passwordHint: string
}

/**
 * The demonstration-credentials panel is rendered ONLY when the server
 * component passes `demo` — i.e. when server-side demonstration mode is
 * enabled (DEMO_MODE). No NEXT_PUBLIC_ variable is involved: the decision
 * is made on the server for every request, and demo accounts are rejected
 * server-side in the login API when the mode is off.
 */
export default function LoginForm({ demo }: { demo: DemoPanel | null }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      router.push('/console')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.')
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your church website."
      footer={
        <>
          New to OpenChurch?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
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
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="pr-10"
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
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      {demo ? (
        <div className="mt-6 rounded-lg bg-muted/60 border text-xs leading-relaxed p-3 text-muted-foreground">
          <p className="font-medium text-foreground">
            Demonstration accounts <span className="font-normal">(password: {demo.passwordHint})</span>
          </p>
          <ul className="mt-1 space-y-0.5">
            {demo.accounts.map((account) => (
              <li key={account.email}>
                <span className="font-mono">{account.email}</span>
                <span aria-hidden> — </span>
                <span>{account.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 italic">
            This instance runs in demonstration mode. Set the server-side
            DEMO_MODE variable to false on a production instance to disable
            these accounts.
          </p>
        </div>
      ) : null}
    </AuthShell>
  )
}
