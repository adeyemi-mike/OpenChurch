'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound, Loader2, LogOut, ShieldCheck, ShieldOff, Trash2, UserCog, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

/** Plan selector for a church (custom-domain entitlement control). */
export function AdminPlanSelect({
  churchId,
  plan,
}: {
  churchId: string
  plan: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [value, setValue] = useState(plan)

  async function change(next: string) {
    if (next === value) return
    setPending(true)
    setValue(next)
    try {
      await apiFetch('/api/admin/churches', {
        method: 'POST',
        body: JSON.stringify({ churchId, action: 'set-plan', plan: next }),
      })
      toast.success(`Plan updated to “${next}”.`)
      router.refresh()
    } catch (err) {
      setValue(value)
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update the plan.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />}
      <select
        aria-label="Church plan"
        value={value}
        disabled={pending}
        onChange={(e) => void change(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-xs"
      >
        <option value="free">free</option>
        <option value="paid">paid</option>
        <option value="premium">premium</option>
      </select>
    </div>
  )
}

/** Suspend / resume a custom domain (platform administrators only). */
export function AdminDomainActions({
  domainId,
  domain,
  status,
}: {
  domainId: string
  domain: string
  status: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const suspended = status === 'SUSPENDED'

  async function toggle() {
    const action = suspended ? 'resume' : 'suspend'
    const message = suspended
      ? `Resume “${domain}”? It returns to its pre-suspension state.`
      : `Suspend “${domain}”? It stops resolving immediately (the church keeps its platform address).`
    if (!confirm(message)) return
    setPending(true)
    try {
      await apiFetch('/api/admin/domains', {
        method: 'POST',
        body: JSON.stringify({ domainId, action }),
      })
      toast.success(suspended ? 'Domain resumed.' : 'Domain suspended.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update the domain.')
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
      aria-label={suspended ? `Resume ${domain}` : `Suspend ${domain}`}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : suspended ? (
        <ShieldCheck className="size-3.5" aria-hidden />
      ) : (
        <ShieldOff className="size-3.5" aria-hidden />
      )}
      {suspended ? 'Resume' : 'Suspend'}
    </Button>
  )
}

/**
 * Irreversible church deletion (platform administrators only). The operator
 * must type the church's slug to confirm. Provider-assigned custom domains
 * are removed from the hosting provider first (failures are reported
 * honestly), media files are deleted from storage, and the database cascade
 * removes every tenant row.
 */
export function AdminDeleteChurch({ churchId, slug, name }: { churchId: string; slug: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmSlug, setConfirmSlug] = useState('')
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    if (confirmSlug !== slug) {
      toast.error('Type the church address exactly to confirm.')
      return
    }
    setPending(true)
    try {
      const res = await apiFetch<{ providerRemovalFailures?: string[] }>('/api/admin/churches', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete-church', churchId, confirmSlug }),
      })
      toast.success(`Deleted “${name}” and all of its data.`)
      if (res.providerRemovalFailures && res.providerRemovalFailures.length > 0) {
        toast.warning(
          `These domains could not be removed from the hosting provider (clean them up in the provider dashboard): ${res.providerRemovalFailures.join(', ')}`
        )
      }
      setOpen(false)
      setConfirmSlug('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the church.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        aria-label={`Delete ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" aria-hidden />
        <span className="sr-only sm:not-sr-only">Delete</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{name}” permanently?</DialogTitle>
            <DialogDescription>
              This deletes every page, sermon, event, ministry, leader, enquiry, media file and
              member record for this church. It cannot be undone. Type the church address{' '}
              <code className="rounded bg-muted px-1">{slug}</code> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`confirm-slug-${churchId}`}>Church address</Label>
            <Input
              id={`confirm-slug-${churchId}`}
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={slug}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending || confirmSlug !== slug}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Platform-admin account tools (data-subject requests): look up an account,
 * download its JSON export, or delete it (refused while it owns churches).
 */
export function AdminUserTools() {
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleExport() {
    if (!email.trim()) {
      toast.error('Enter the account email first.')
      return
    }
    setPending(true)
    try {
      // Navigation GET → the endpoint answers with a JSON attachment.
      window.location.href = `/api/admin/users?email=${encodeURIComponent(email.trim().toLowerCase())}`
    } finally {
      setTimeout(() => setPending(false), 1200)
    }
  }

  async function handleDelete() {
    setPending(true)
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete-user', email, confirmEmail }),
      })
      toast.success('Account deleted.')
      setDeleteOpen(false)
      setEmail('')
      setConfirmEmail('')
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the account.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="admin-user-email">Account email</Label>
          <Input
            id="admin-user-email"
            type="email"
            placeholder="person@example.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={handleExport} disabled={pending}>
          <Download className="size-4" aria-hidden />
          Export account data
        </Button>
      </div>
      <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        Deleting an account removes its sessions and memberships permanently. Accounts that own a
        church must transfer ownership first.{' '}
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-destructive underline underline-offset-2"
          onClick={() => setDeleteOpen(true)}
          disabled={!email.trim()}
        >
          Delete this account instead
        </Button>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-4" aria-hidden /> Delete account
            </DialogTitle>
            <DialogDescription>
              Irreversible. Type the email twice to confirm. If the account owns any church, the
              deletion is refused with instructions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-del-email-1">Account email</Label>
            <Input
              id="admin-del-email-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-del-email-2">Confirm email</Label>
            <Input
              id="admin-del-email-2"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending || !email.trim() || email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
