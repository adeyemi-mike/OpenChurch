'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound, Loader2, LogOut, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch, ApiClientError } from '@/lib/client/api'

/** Suspend / reactivate a church (platform administrators only). */
export function AdminChurchActions({
  churchId,
  churchName,
  status,
}: {
  churchId: string
  churchName: string
  status: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const suspended = status === 'SUSPENDED'

  async function toggle() {
    const nextStatus = suspended ? 'ACTIVE' : 'SUSPENDED'
    const message = suspended
      ? `Reactivate “${churchName}”? Its members regain dashboard access.`
      : `Suspend “${churchName}”? Its members lose dashboard access until it is reactivated.`
    if (!confirm(message)) return
    setPending(true)
    try {
      await apiFetch('/api/admin', {
        method: 'POST',
        body: JSON.stringify({ churchId, status: nextStatus }),
      })
      toast.success(suspended ? 'Church reactivated.' : 'Church suspended.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update the church status.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={pending}
      className={suspended ? '' : 'text-destructive hover:text-destructive'}
      aria-label={suspended ? `Reactivate ${churchName}` : `Suspend ${churchName}`}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : suspended ? (
        <ShieldCheck className="size-3.5" aria-hidden />
      ) : (
        <ShieldOff className="size-3.5" aria-hidden />
      )}
      {suspended ? 'Activate' : 'Suspend'}
    </Button>
  )
}

/** Sign out of the platform administration area. */
export function PlatformSignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
      router.refresh()
    } catch {
      setPending(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
      Sign out
    </Button>
  )
}

/**
 * Platform-admin password reset. This instance does not send email (SMTP is
 * optional), so the supported recovery path is: the user contacts their
 * platform administrator, who resets the password here. All of the user's
 * sessions are revoked as part of the reset.
 */
export function AdminPasswordReset() {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pending, setPending] = useState(false)

  const passwordsMatch = newPassword === confirmPassword
  const canSubmit =
    !pending && email.includes('@') && newPassword.length >= 8 && passwordsMatch

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordsMatch) {
      toast.error('The two passwords do not match.')
      return
    }
    if (
      !confirm(
        `Reset the password for ${email}? All of their signed-in sessions will be signed out.`
      )
    )
      return
    setPending(true)
    try {
      const res = await apiFetch('/api/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, newPassword }),
      })
      const revoked = (res as { sessionsRevoked?: number }).sessionsRevoked ?? 0
      toast.success(`Password reset for ${email}. ${revoked} session(s) signed out.`)
      setEmail('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not reset the password.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="reset-email">User&apos;s email address</Label>
        <Input
          id="reset-email"
          type="email"
          autoComplete="off"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="owner@church-example.org"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat the password"
            aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
          />
          {confirmPassword.length > 0 && !passwordsMatch ? (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          ) : null}
        </div>
      </div>
      <Button type="submit" disabled={!canSubmit}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <KeyRound className="size-4" aria-hidden />
        )}
        Reset password
      </Button>
    </form>
  )
}
