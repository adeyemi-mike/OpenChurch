import 'server-only'

/**
 * Hosting-provider domain adapter.
 *
 * Custom domains need a HOSTING assignment in addition to ownership: the
 * domain must be attached to the running application at the provider so
 * requests actually reach it (and the provider can provision SSL). The
 * adapter is the ONLY place that talks to a provider API, so the rest of
 * the domain system stays provider-agnostic.
 *
 * Truthfulness rule (project-wide): a provider adapter must never report
 * success unless the provider's API confirms it. API errors surface as
 * errors — they NEVER degrade into a fake success state.
 */

export type ProviderDnsRecord = {
  /** e.g. "A" | "CNAME" | "TXT" */
  type: string
  /** DNS host/name the church sets at their registrar ("@" for apex). */
  name: string
  /** Required value. */
  value: string
  /** Optional note displayed under the record. */
  note?: string
}

export type ProviderDomainStatus = {
  /** Provider confirmed the domain is assigned to this project. */
  assigned: boolean
  /** Provider confirmed DNS configuration (or reports misconfigured). */
  dnsConfigured: boolean | null
  /** Human-readable problem from the provider, if any. */
  error: string | null
  /** Records the church must set at their registrar, per the provider. */
  requiredRecords: ProviderDnsRecord[]
  /** Raw status summary persisted for diagnostics (JSON, never trusted). */
  raw: Record<string, unknown>
}

export type DomainProvider = {
  readonly kind: 'vercel' | 'manual'
  /** Attach the domain to the hosting project. */
  addDomain(domain: string): Promise<{ ok: true } | { ok: false; error: string }>
  /** Remove the domain from the hosting project. */
  removeDomain(domain: string): Promise<{ ok: true } | { ok: false; error: string }>
  /** Inspect the provider's view of the domain. */
  inspectDomain(domain: string): Promise<ProviderDomainStatus>
}

// ---------------------------------------------------------------------------
// Vercel adapter — REST API (https://api.vercel.com)
// ---------------------------------------------------------------------------

const VERCEL_API = 'https://api.vercel.com'

export type VercelConfig = {
  token: string
  projectId: string
  teamId?: string
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch
}

export class VercelDomainProvider implements DomainProvider {
  readonly kind = 'vercel' as const
  private token: string
  private projectId: string
  private teamId?: string
  private fetchImpl: typeof fetch

  constructor(cfg: VercelConfig) {
    this.token = cfg.token
    this.projectId = cfg.projectId
    this.teamId = cfg.teamId
    this.fetchImpl = cfg.fetchImpl ?? fetch
  }

  private async call(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const url = new URL(path, VERCEL_API)
    if (this.teamId) url.searchParams.set('teamId', this.teamId)
    const res = await this.fetchImpl(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    let json: Record<string, unknown> = {}
    try {
      json = (await res.json()) as Record<string, unknown>
    } catch {
      json = {}
    }
    return { status: res.status, json }
  }

  async addDomain(domain: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { status, json } = await this.call('POST', `/v10/projects/${this.projectId}/domains`, {
      name: domain,
    })
    if (status === 200) return { ok: true }
    if (status === 409) {
      const err = (json['error'] as { message?: string } | undefined)?.message
      return {
        ok: false,
        error:
          err ??
          'Vercel reports this domain is already assigned to another project. Remove it there first, then retry.',
      }
    }
    if (status === 401 || status === 403) {
      return { ok: false, error: 'Vercel rejected the API token — check VERCEL_TOKEN and project access.' }
    }
    return { ok: false, error: `Vercel could not add the domain (HTTP ${status}).` }
  }

  async removeDomain(domain: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { status } = await this.call('DELETE', `/v10/projects/${this.projectId}/domains/${encodeURIComponent(domain)}`)
    if (status === 200 || status === 204) return { ok: true }
    // 404: already gone — treat as success (idempotent removal).
    if (status === 404) return { ok: true }
    return { ok: false, error: `Vercel could not remove the domain (HTTP ${status}).` }
  }

  async inspectDomain(domain: string): Promise<ProviderDomainStatus> {
    const { status, json } = await this.call(
      'GET',
      `/v10/projects/${this.projectId}/domains/${encodeURIComponent(domain)}`
    )
    if (status === 404) {
      return {
        assigned: false,
        dnsConfigured: null,
        error: 'The domain is not attached to the Vercel project yet.',
        requiredRecords: [],
        raw: { status },
      }
    }
    if (status !== 200) {
      return {
        assigned: false,
        dnsConfigured: null,
        error: `Vercel status check failed (HTTP ${status}).`,
        requiredRecords: [],
        raw: { status },
      }
    }

    const verified = json['verified'] === true
    const verificationError = (json['verificationError'] as string | undefined) ?? null
    const config = (json['config'] as Record<string, unknown> | undefined) ?? {}
    const misconfigured = config['misconfigured'] === true

    // Required DNS records: derived from the provider's config payload —
    // never hardcoded. Vercel reports an A record for apex domains and a
    // CNAME for subdomains when the domain is attached.
    const requiredRecords: ProviderDnsRecord[] = []
    const aRecord = (config['aRecordValue'] ?? config['aRecord']) as string | undefined
    const cnameRecord = (config['cnameRecordValue'] ?? config['cnameRecord']) as string | undefined
    if (cnameRecord) {
      requiredRecords.push({
        type: 'CNAME',
        name: domain,
        value: String(cnameRecord),
        note: 'Set at your DNS provider (subdomain / www).',
      })
    } else if (aRecord) {
      requiredRecords.push({
        type: 'A',
        name: '@',
        value: String(aRecord),
        note: 'Set on the apex/root domain at your DNS provider.',
      })
    }
    // Vercel's own project-assignment verification record, when required.
    const verification = json['verification'] as { type?: string; domain?: string; value?: string }[] | undefined
    if (Array.isArray(verification)) {
      for (const v of verification) {
        if (v?.type === 'TXT' && v.domain && v.value) {
          requiredRecords.push({
            type: 'TXT',
            name: v.domain,
            value: v.value,
            note: 'Vercel project-verification record (shown by the Vercel API).',
          })
        }
      }
    }

    return {
      assigned: verified,
      dnsConfigured: misconfigured ? false : verified ? true : null,
      error: verificationError ?? (misconfigured ? 'Vercel reports the DNS configuration is not correct yet.' : null),
      requiredRecords,
      raw: { status, verified, misconfigured, verificationError },
    }
  }
}

// ---------------------------------------------------------------------------
// Manual adapter — self-hosted / providers without an API
// ---------------------------------------------------------------------------

/**
 * Manual mode: no provider API exists (or none is configured). Hosting
 * assignment cannot be automated; the church owner follows documented
 * steps (point DNS at their server, configure the reverse proxy) and the
 * status reflects "owner-confirmed", which the UI labels honestly.
 */
export class ManualDomainProvider implements DomainProvider {
  readonly kind = 'manual' as const

  async addDomain(): Promise<{ ok: true } | { ok: false; error: string }> {
    // "ok" here means "no automated step failed" — the manual workflow
    // simply has nothing to automate. The domain stays owner-confirmed.
    return { ok: true }
  }

  async removeDomain(): Promise<{ ok: true } | { ok: false; error: string }> {
    return { ok: true }
  }

  async inspectDomain(domain: string): Promise<ProviderDomainStatus> {
    return {
      assigned: false,
      dnsConfigured: null,
      error: null,
      requiredRecords: [
        {
          type: 'A',
          name: '@',
          value: '<your server IPv4>',
          note: 'This deployment has no hosting-provider API — point the domain at your server and configure your reverse proxy. Ask your administrator.',
        },
      ],
      raw: { mode: 'manual', domain },
    }
  }
}

/**
 * Resolve the active provider from server-side environment configuration.
 * Returns null when nothing is configured (the domain UI then explains
 * that automated hosting assignment is unavailable — never a fake state).
 */
export function getDomainProvider(): (DomainProvider & { configured: boolean }) | null {
  const token = process.env.VERCEL_TOKEN?.trim()
  const projectId = process.env.VERCEL_PROJECT_ID?.trim()
  if (token && projectId) {
    const teamId = process.env.VERCEL_TEAM_ID?.trim() || undefined
    const p = new VercelDomainProvider({ token, projectId, teamId })
    return Object.assign(p, { configured: true })
  }
  const manual = new ManualDomainProvider()
  return Object.assign(manual, { configured: false })
}

/** True when the Vercel adapter is fully configured (for status display). */
export function isVercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN?.trim() && process.env.VERCEL_PROJECT_ID?.trim())
}
