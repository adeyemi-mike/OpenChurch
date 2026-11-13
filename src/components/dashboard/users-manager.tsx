px-4 py-3 text-sm"
                  >
                    {addError}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Role explanations */}
          <Card>
            <CardHeader>
              <CardTitle>What each role can do</CardTitle>
              <CardDescription>
                Permissions are always enforced on the server — hiding buttons is never the check itself.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                {CHURCH_ROLES.map((r) => (
                  <div key={r} className="rounded-xl border p-4">
                    <dt className="flex items-center gap-2 text-sm font-semibold">
                      <RoleBadge role={r} />
                    </dt>
                    <dd className="mt-2 text-sm leading-snug text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Crown, Info, Loader2, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import {
  CHURCH_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  can,
  type ChurchRole,
} from '@/lib/permissions'

type Member = {
  id: string
  userId: string
  name: string
  email: string
  role: ChurchRole
  createdAt: string
}

const ASSIGNABLE_ROLES: ChurchRole[] = ['ADMIN', 'EDITOR', 'AUTHOR']

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function RoleBadge({ role }: { role: ChurchRole }) {
  if (role === 'OWNER') {
    return (
      <Badge className="gap-1">
        <Crown className="size-3" aria-hidden /> Owner
      </Badge>
    )
  }
  if (role === 'ADMIN') return <Badge variant="default">{ROLE_LABELS[role]}</Badge>
  if (role === 'EDITOR') return <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
  return <Badge variant="outline">{ROLE_LABELS[role]}</Badge>
}

export function UsersManager({
  slug,
  role,
  viewerEmail,
}: {
  slug: string
  role: ChurchRole
  viewerEmail: string
}) {
  const canManage = can(role, 'church:manage_users')

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<ChurchRole>('EDITOR')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ members: Member[] }>(`/api/dashboard/${slug}/users`)
      setMembers(res.members)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load members.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  const ownerCount = members.filter((m) => m.role === 'OWNER').length
  const viewer = members.find((m) => m.email === viewerEmail) ?? null
  const viewerIsLastOwner = viewer?.role === 'OWNER' && ownerCount <= 1

  async function changeRole(member: Member, nextRole: ChurchRole) {
    setBusyId(member.id)
    try {
      await apiFetch(`/api/dashboard/${slug}/users/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      })
      toast.success(`${member.name} is now ${ROLE_LABELS[nextRole].toLowerCase()}.`)
      load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not change the role.')
    } finally {
      setBusyId(null)
    }
  }

  async function removeMember(member: Member) {
    if (!confirm(`Remove ${member.name} (${member.email}) from this church?`)) return
    setBusyId(member.id)
    try {
      await apiFetch(`/api/dashboard/${slug}/users/${member.id}`, { method: 'DELETE' })
      toast.success(`${member.name} has been removed.`)
      load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not remove the member.')
    } finally {
      setBusyId(null)
    }
  }

  async function addMember() {
    if (!addEmail.trim()) {
      toast.error('Enter the email address of the person to add.')
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      await apiFetch(`/api/dashboard/${slug}/users`, {
        method: 'POST',
        body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
      })
      toast.success('Member added.')
      setAddEmail('')
      setAddRole('EDITOR')
      load()
    } catch (err) {
      // Show the server's honest message inline — especially the
      // "no account uses that email yet" hint.
      setAddError(err instanceof ApiClientError ? err.message : 'Could not add the member.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users &amp; roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          People with dashboard access to this church, and what each of them can do.
        </p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-muted-foreground" role="status">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : (
        <>
          {/* Member list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="size-4 text-muted-foreground" aria-hidden /> Members
                <Badge variant="secondary">{members.length}</Badge>
              </CardTitle>
              <CardDescription>
                {ownerCount} owner{ownerCount === 1 ? '' : 's'} · role changes take effect immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {viewerIsLastOwner ? (
                <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  You are the only owner of this church. Ownership transfer is not available in this
                  version, so your own role and membership stay locked.
                </p>
              ) : null}
              <ul className="divide-y">
                {members.map((member) => {
                  const isViewer = member.email === viewerEmail
                  const locked = isViewer && viewerIsLastOwner
                  return (
                    <li key={member.id} className="flex flex-wrap items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                      <span
                        className="grid place-items-center size-10 shrink-0 rounded-full bg-primary/10 text-sm font-semibold text-primary"
                        aria-hidden
                      >
                        {initials(member.name) || '?'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          <span className="truncate">{member.name}</span>
                          {isViewer ? <Badge variant="secondary">You</Badge> : null}
                          <RoleBadge role={member.role} />
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {member.email} · joined {new Date(member.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          <Select
                            value={member.role}
                            onValueChange={(v) => changeRole(member, v as ChurchRole)}
                            disabled={busyId === member.id || locked}
                          >
                            <SelectTrigger
                              className="w-40"
                              aria-label={`Role for ${member.name}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {member.role === 'OWNER' ? (
                                <SelectItem value="OWNER" disabled>
                                  {ROLE_LABELS.OWNER}
                                </SelectItem>
                              ) : null}
                              {ASSIGNABLE_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 text-destructive hover:text-destructive"
                            onClick={() => removeMember(member)}
                            disabled={busyId === member.id || locked}
                            aria-label={`Remove ${member.name}`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Add member */}
          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="size-4 text-muted-foreground" aria-hidden /> Add a member
                </CardTitle>
                <CardDescription>
                  They need an OpenChurch account first — invitations by email are not available in this
                  version.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="add-email">Email address</Label>
                    <Input
                      id="add-email"
                      type="email"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="person@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="add-role">Role</Label>
                    <Select value={addRole} onValueChange={(v) => setAddRole(v as ChurchRole)}>
                      <SelectTrigger id="add-role" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={addMember} disabled={adding}>
                    {adding ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <UserPlus className="size-4" aria-hidden />
                    )}
                    Add member
                  </Button>
                </div>
                {addError ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive 