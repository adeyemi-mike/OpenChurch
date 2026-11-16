'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiFetch, ApiClientError } from '@/lib/client/api'
import { can, type ChurchRole } from '@/lib/permissions'

/**
 * Custom-domain management UI.
 *
 * Workflow per domain:
 *   1. Add domain          → TXT record instructions (copyable)
 *   2. Verify ownership    → server-side DNS TXT check
 *   3. Connect hosting     → automated (Vercel) with the provider's own DNS
 *                            records + confirmation, or manual confirmation
 *                            on self-hosted deployments
 *   4. Check status        → provider inspection + HTTPS probe; progresses
 *                            Pending DNS → Pending SSL → Active, and can
 *                            downgrade a domain the provider lost
 *   5. Set primary         → canonical URLs, sitemap and metadata follow it;
 *                            non-primary domains redirect to the primary
 *
 * Status colours only turn green when the underlying checks actually
 * succeeded — no optimistic or fabricated success states.
 */

type DomainView = {
  id: string
  domain: string
  status: string
  isPrimary: boolean
  provider: string | null
  providerRef: string | null
  dnsStatus: string | null
  sslStatus: string | null
  failureReason: string | null
  verifiedAt: string | null
  lastCheckedAt: string | null
  tokenExpiresAt: string | null
  verificationToken?: string
  txtRecord?: { name: string; value: string }
  providerInfo?: {
    assigned: boolean
    dnsConfigured: boolean | null
    error: string | null
    requiredRecords: { type: string; name: string; value: string; note?: string }[]
  } | null
}

type ProviderInfo = {
  vercelConfigured: boolean
  automated: 'vercel' | 'manual'
}

/** What THIS deployment supports, per src/lib/domains/capability.ts. */
type Capability = {
  mode: 'managed-auto' | 'self-hosted' | 'unavailable'
  automated: boolean
  summary: string
}

/** The church's plan entitlement, per src/lib/domains/entitlements.ts. */
type Entitlement = {
  plan: 'free' | 'paid' | 'premium'
  limit: number
  used: number
  canAdd: boolean
  upgradeHint: string | null
}

/** Statuses a provider recheck ("Check status") applies to. */
const RECHECKABLE = ['PENDING_DNS', 'PENDING_SSL', 'ACTIVE', 'FAILED']

const TONE_CLASSES: Record<string, string> = {
  green: 'gap-1 bg-emerald-600 hover:bg-emerald-600',
  blue: 'gap-1 bg-sky-600 hover:bg-sky-600',
  amber: 'gap-1 text-amber-700 border-amber-300 bg-amber-50',
  red: 'gap-1 text-red-700 border-red-300 bg-red-50',
  gray: 'gap-1 text-muted-foreground',
}

function statusBadge(d: DomainView) {
  const toneFor = (status: string): { label: string; tone: string; icon: 'star' | 'check' | 'shield' | 'alert' | 'x' } => {
    if (status === 'ACTIVE')
      return d.isPrimary
        ? { label: 'Active · Primary', tone: 'green', icon: 'star' }
        : { label: 'Active', tone: 'green', icon: 'check' }
    if (status === 'PENDING') return { label: 'Pending verification', tone: 'amber', icon: 'shield' }
    if (status === 'VERIFICATION_FAILED') return { label: 'Verification failed — retry', tone: 'red', icon: 'alert' }
    if (status === 'VERIFIED') return { label: 'Verified — connect hosting', tone: 'blue', icon: 'shield' }
    if (status === 'PENDING_DNS') return { label: 'Pending DNS', tone: 'amber', icon: 'shield' }
    if (status === 'PENDING_SSL') return { label: 'DNS ok — SSL provisioning', tone: 'amber', icon: 'shield' }
    if (status === 'FAILED') return { label: 'Failed — retry connection', tone: 'red', icon: 'alert' }
    if (status === 'SUSPENDED') return { label: 'Suspended by operator', tone: 'gray', icon: 'x' }
    return { label: status, tone: 'gray', icon: 'x' }
  }
  const { label, tone, icon } = toneFor(d.status)
  const Icon =
    icon === 'star' ? Star : icon === 'check' ? BadgeCheck : icon === 'shield' ? ShieldCheck : icon === 'alert' ? ShieldAlert : ShieldAlert
  if (tone === 'amber' || tone === 'red' || tone === 'gray') {
    return (
      <Badge variant="outline" className={TONE_CLASSES[tone]}>
        <Icon className="size-3" aria-hidden /> {label}
      </Badge>
    )
  }
  return (
    <Badge className={TONE_CLASSES[tone]}>
      <Icon className="size-3" aria-hidden /> {label}
    </Badge>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error('Could not copy — select the text and copy manually.')
        }
      }}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

export function DomainsManager({
  slug,
  role,
  platformUrl,
  subdomainUrl,
  churchName,
}: {
  slug: string
  role: ChurchRole
  platformUrl: string
  subdomainUrl: string | null
  churchName: string
}) {
  const [domains, setDomains] = useState<DomainView[]>([])
  const [provider, setProvider] = useState<ProviderInfo | null>(null)
  const [capability, setCapability] = useState<Capability | null>(null)
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<DomainView | null>(null)
  const canManage = can(role, 'domains:manage')

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{
        domains: DomainView[]
        provider: ProviderInfo
        capability: Capability
        entitlement: Entitlement
      }>(`/api/dashboard/${slug}/domains`)
      setDomains(res.domains)
      setProvider(res.provider)
      setCapability(res.capability)
      setEntitlement(res.entitlement)
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not load domains.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  async function addDomain() {
    setAdding(true)
    try {
      const res = await apiFetch<{ domain: DomainView; companionSuggestion?: string }>(
        `/api/dashboard/${slug}/domains`,
        {
          method: 'POST',
          body: JSON.stringify({ domain: newDomain }),
        }
      )
      const d = res.domain
      toast.success(`${d.domain} added — add the TXT record below, then verify.`)
      if (res.companionSuggestion) {
        toast.info(`Also own ${res.companionSuggestion}? Add it separately so both addresses work — each domain is verified independently.`)
      }
      setNewDomain('')
      await load()
      // The list endpoint never returns tokens (security) — the add response
      // does. Merge it in so the instructions are visible immediately:
      if (d.verificationToken) {
        setDomains((prev) =>
          prev.map((x) => (x.id === d.id ? { ...x, verificationToken: d.verificationToken, txtRecord: d.txtRecord } : x))
        )
      }
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not add the domain.')
    } finally {
      setAdding(false)
    }
  }

  async function act(domainId: string, action: string) {
    setBusyId(domainId)
    try {
      const res = await apiFetch<{ domain: DomainView }>(`/api/dashboard/${slug}/domains/${domainId}`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      const d = res.domain
      if (action === 'verify') {
        if (d.status === 'VERIFIED' || d.status === 'PENDING_DNS' || d.status === 'PENDING_SSL' || d.status === 'ACTIVE')
          toast.success('Ownership verified — now connect hosting.')
        else toast.info(d.failureReason ?? 'Verification is not complete yet.')
      }
      if (action === 'connect') {
        if (d.status === 'ACTIVE') toast.success('Hosting confirmed — the domain is live.')
        else if (d.status === 'PENDING_SSL') toast.info('DNS is configured — SSL certificate provisioning is in progress.')
        else toast.info(d.failureReason ?? 'Hosting assignment is pending — set the DNS records shown below.')
      }
      if (action === 'recheck') {
        if (d.status === 'ACTIVE') toast.success('All checks pass — the domain is live.')
        else if (d.status === 'FAILED') toast.error(d.failureReason ?? 'The hosting provider no longer has this domain attached.')
        else toast.info(d.failureReason ?? 'Still in progress — DNS and SSL can take a little while.')
      }
      if (action === 'confirm-manual') toast.success('Marked active (owner-confirmed, self-hosted).')
      if (action === 'set-primary') toast.success('Primary domain updated — canonical URLs now use it.')
      if (action === 'regenerate-token') {
        toast.success('New verification token generated — the old one is invalid.')
        if (d.verificationToken) {
          setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...d } : x)))
          setBusyId(null)
          return
        }
      }
      await load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'The action failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function removeDomain(d: DomainView) {
    setBusyId(d.id)
    try {
      await apiFetch(`/api/dashboard/${slug}/domains/${d.id}`, { method: 'DELETE' })
      toast.success(`${d.domain} removed. Your platform address keeps working.`)
      setConfirmRemove(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not remove the domain.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Globe className="size-6 text-primary" aria-hidden /> Custom domains
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Serve {churchName}&apos;s website on your own domain (e.g. www.yourchurch.org). Your platform
            address keeps working: <a className="underline underline-offset-2" href={platformUrl} target="_blank" rel="noopener noreferrer">{platformUrl.replace(/^https?:\/\//, '')}</a>
            {subdomainUrl && (
              <>
                {' '}· subdomain address: <a className="underline underline-offset-2" href={subdomainUrl} target="_blank" rel="noopener noreferrer">{subdomainUrl.replace(/^https?:\/\//, '')}</a>
              </>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
          <RefreshCw className="size-3.5" aria-hidden /> Refresh
        </Button>
      </div>

      {capability?.mode === 'unavailable' ? (
        <div className="rounded-xl border bg-muted/40 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
            <div className="space-y-3 text-sm">
              <p className="font-medium">Custom domains are not available on this deployment</p>
              <p className="text-muted-foreground">
                This hosted demonstration serves every church website from its platform address
                (above), and this instance runs on managed hosting without the domain-assignment
                integration — the platform cannot complete the required hosting configuration here.
                Rather than offer steps that cannot succeed, the dashboard reports domains as
                unavailable.
              </p>
              <div className="text-muted-foreground">
                <p className="font-medium text-foreground">OpenChurch supports custom domains in two deployment models:</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  <li>
                    <strong className="text-foreground">Self-hosted installations</strong> — administrators configure
                    custom domains and subdomain routing on infrastructure they control
                    (docs/DEPLOYMENT.md in the repository).
                  </li>
                  <li>
                    <strong className="text-foreground">Managed hosting</strong> — church owners connect and manage a
                    custom domain directly from this dashboard (ownership verification, DNS
                    instructions, hosting-provider assignment, SSL status, primary domain), enabled
                    by the operator through the provider integration (e.g.
                    <code className="mx-1 rounded bg-muted px-1">VERCEL_TOKEN</code> +
                    <code className="mx-1 rounded bg-muted px-1">VERCEL_PROJECT_ID</code> on Vercel).
                  </li>
                </ul>
              </div>
              <p className="text-muted-foreground">
                Your website stays fully reachable at the platform address above.
              </p>
            </div>
          </div>
        </div>
      ) : (
        capability?.mode === 'self-hosted' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            This deployment is self-hosted without an automated hosting integration — domain connection
            uses the <strong>manual workflow</strong>: verify ownership with the TXT record, point your domain&apos;s
            DNS at this server, then confirm below. (Operators can enable automated Vercel assignment with
            <code className="mx-1 rounded bg-amber-100 dark:bg-amber-900 px-1">VERCEL_TOKEN</code> and
            <code className="mx-1 rounded bg-amber-100 dark:bg-amber-900 px-1">VERCEL_PROJECT_ID</code>, or declare
            other hosts with
            <code className="mx-1 rounded bg-amber-100 dark:bg-amber-900 px-1">CUSTOM_DOMAIN_MODE</code>.)
          </div>
        )
      )}

      {capability?.mode !== 'unavailable' && entitlement && (
        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Plan: {entitlement.plan}</span>
            <Badge variant="outline">
              {entitlement.used} of {entitlement.limit === 0 ? '0' : entitlement.limit} domain
              {entitlement.limit === 1 ? '' : 's'} connected
            </Badge>
            {!entitlement.canAdd && entitlement.limit === 0 && (
              <span className="text-muted-foreground">
                Custom domains are included with paid plans — ask your platform operator about upgrading.
              </span>
            )}
            {!entitlement.canAdd && entitlement.limit > 0 && (
              <span className="text-muted-foreground">
                Your plan&apos;s domain limit is reached. Remove a domain or ask your platform operator about upgrading.
              </span>
            )}
          </div>
        </div>
      )}

      {capability?.mode !== 'unavailable' && canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a domain</CardTitle>
            <CardDescription>
              Enter your domain — apex (yourchurch.org), www (www.yourchurch.org) or a subdomain.
              You will verify ownership with a DNS TXT record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col sm:flex-row gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (newDomain.trim()) void addDomain()
              }}
            >
              <div className="flex-1">
                <Label htmlFor="new-domain" className="sr-only">Domain</Label>
                <Input
                  id="new-domain"
                  placeholder="www.yourchurch.org"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="url"
                />
              </div>
              <Button type="submit" disabled={adding || !newDomain.trim()} className="gap-1.5">
                {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                Add domain
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-label="Loading" />
        </div>
      ) : domains.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {capability?.mode === 'unavailable'
              ? 'No custom domains to show.'
              : 'No custom domains yet — add your church\u2019s domain above to get started.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {domains.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 break-all">
                    {d.domain}
                    {d.isPrimary && d.status === 'ACTIVE' && (
                      <Star className="size-4 fill-amber-400 text-amber-400" aria-label="Primary domain" />
                    )}
                  </CardTitle>
                  {statusBadge(d)}
                </div>
                {d.lastCheckedAt && (
                  <CardDescription>Last checked {new Date(d.lastCheckedAt).toLocaleString()}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {capability?.mode === 'unavailable' ? (
                  <p className="text-sm text-muted-foreground">
                    Domain management is not available on this deployment (see the notice above). This
                    record is shown read-only and can be removed.
                  </p>
                ) : (
                  <>
                {/* Step 1 — TXT ownership verification */}
                {(d.status === 'PENDING' || d.status === 'VERIFICATION_FAILED' || (d.verificationToken && d.txtRecord)) && d.txtRecord && (
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                    <p className="text-sm font-medium">Step 1 — Verify ownership: add this TXT record at your DNS provider</p>
                    <div className="grid gap-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted-foreground">Type</span>
                        <code className="rounded bg-background border px-2 py-0.5">TXT</code>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted-foreground">Name / Host</span>
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-background border px-2 py-0.5 break-all">{d.txtRecord.name}</code>
                          <CopyButton value={d.txtRecord.name} label="record name" />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted-foreground">Value</span>
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-background border px-2 py-0.5 break-all">{d.txtRecord.value}</code>
                          <CopyButton value={d.txtRecord.value} label="record value" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => void act(d.id, 'verify')} disabled={busyId === d.id} className="gap-1.5">
                        {busyId === d.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ShieldCheck className="size-3.5" aria-hidden />}
                        {d.status === 'VERIFICATION_FAILED' ? 'Retry verification' : 'Verify ownership'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void act(d.id, 'regenerate-token')} disabled={busyId === d.id} className="gap-1.5">
                        <RefreshCw className="size-3.5" aria-hidden /> New token
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {d.tokenExpiresAt ? `Token expires ${new Date(d.tokenExpiresAt).toLocaleString()}` : null}
                      </span>
                    </div>
                    {d.failureReason && (d.status === 'PENDING' || d.status === 'VERIFICATION_FAILED') && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">{d.failureReason}</p>
                    )}
                  </div>
                )}

                {/* Step 2 — hosting */}
                {(d.status === 'VERIFIED' || d.status === 'FAILED') && (
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                    <p className="text-sm font-medium">
                      {d.status === 'FAILED' ? 'Hosting failed — retry the connection' : 'Step 2 — Connect hosting'}
                      {provider?.vercelConfigured
                        ? ' (automated via Vercel)'
                        : ' (self-hosted: point DNS at your server, then confirm)'}
                    </p>
                    {provider?.vercelConfigured ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => void act(d.id, 'connect')} disabled={busyId === d.id} className="gap-1.5">
                          {busyId === d.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Globe className="size-3.5" aria-hidden />}
                          {d.status === 'FAILED' ? 'Retry connection' : 'Connect to hosting'}
                        </Button>
                        <span className="text-xs text-muted-foreground">Adds the domain to the Vercel project and shows the required DNS records.</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => void act(d.id, 'confirm-manual')} disabled={busyId === d.id} className="gap-1.5">
                          {busyId === d.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
                          I have pointed DNS at this server
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Set an A record on your domain pointing at this server&apos;s IP, then confirm.
                        </span>
                      </div>
                    )}
                    {d.failureReason && <p className="text-xs text-amber-700 dark:text-amber-400">{d.failureReason}</p>}
                  </div>
                )}

                {/* Provider DNS records (after connect) */}
                {d.providerInfo && d.providerInfo.requiredRecords.length > 0 && d.status !== 'VERIFIED' && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-sm font-medium">DNS records required by the hosting provider</p>
                    <div className="space-y-2">
                      {d.providerInfo.requiredRecords.map((r, i) => (
                        <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="font-mono text-xs rounded bg-muted px-2 py-0.5">{r.type}</span>
                          <code className="text-xs break-all">{r.name}</code>
                          <span className="text-muted-foreground">→</span>
                          <code className="text-xs break-all flex-1 min-w-[200px]">{r.value}</code>
                          <CopyButton value={r.value} label="record value" />
                        </div>
                      ))}
                    </div>
                    {d.providerInfo.error && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">{d.providerInfo.error}</p>
                    )}
                  </div>
                )}

                {/* In-progress / active domain actions */}
                {(RECHECKABLE.includes(d.status) || d.status === 'ACTIVE') && (
                  <div className="flex flex-wrap items-center gap-2">
                    {d.status === 'ACTIVE' && (
                      <a
                        href={`https://${d.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        Open https://{d.domain} <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    )}
                    {d.status === 'ACTIVE' && !d.isPrimary && (
                      <Button size="sm" variant="outline" onClick={() => void act(d.id, 'set-primary')} disabled={busyId === d.id} className="gap-1.5">
                        <Star className="size-3.5" aria-hidden /> Set as primary
                      </Button>
                    )}
                    {provider?.vercelConfigured && RECHECKABLE.includes(d.status) && (
                      <Button size="sm" variant="outline" onClick={() => void act(d.id, 'recheck')} disabled={busyId === d.id} className="gap-1.5">
                        {busyId === d.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
                        {d.status === 'ACTIVE' ? 'Re-check status' : 'Check status'}
                      </Button>
                    )}
                    {/* NOTE: for FAILED domains the retry button lives in the
                        Step 2 card above — no duplicate here. */}
                  </div>
                )}

                {(d.status === 'PENDING_DNS' || d.status === 'PENDING_SSL' || d.status === 'ACTIVE' || d.status === 'FAILED') && d.failureReason && (
                  <p className="text-xs text-muted-foreground">{d.failureReason}</p>
                )}

                {d.sslStatus && (d.status === 'PENDING_SSL' || d.status === 'ACTIVE') && (
                  <p className="text-xs text-muted-foreground">
                    SSL/HTTPS:{' '}
                    {d.sslStatus === 'ACTIVE'
                      ? 'confirmed live (HTTPS probe succeeded).'
                      : d.sslStatus === 'PROVISIONING'
                        ? 'provisioned automatically by the hosting provider once DNS is live.'
                        : d.sslStatus === 'PENDING'
                          ? 'starts once the DNS records above are set.'
                          : d.sslStatus === 'MANAGED_BY_HOST'
                            ? 'managed by your hosting proxy (self-hosted deployment).'
                            : d.sslStatus.toLowerCase()}
                  </p>
                )}
                  </>
                )}

                {canManage && (
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setConfirmRemove(d)} className="gap-1.5 text-destructive hover:text-destructive">
                      <Trash2 className="size-3.5" aria-hidden /> Remove
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={confirmRemove !== null} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {confirmRemove?.domain}?</DialogTitle>
            <DialogDescription>
              The domain stops serving your website immediately. Your platform address keeps working
              and all content is untouched. Removing is audited.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmRemove && void removeDomain(confirmRemove)} disabled={busyId === confirmRemove?.id}>
              {busyId === confirmRemove?.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Remove domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
