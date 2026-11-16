/**
 * Custom-domain lifecycle statuses — the single source of truth shared by
 * the service, resolver, dashboard UI, cron rechecks and the docs.
 *
 * THE MACHINE
 * -----------
 *
 *   PENDING ──verify ok──► VERIFIED ──connect ok──► PENDING_DNS
 *      │                      │  ▲                      │ provider confirms DNS
 *      │ verify failed        │  └─ retry connect       ▼
 *      ▼                      │                    PENDING_SSL ──HTTPS ok──► ACTIVE
 * VERIFICATION_FAILED         │                      ▲    │                    │
 *      │                      │                      │    │ provider lost it   │ recheck finds
 *      └──retry / new token───┘                      │    ▼                    ▼ domain gone
 *                                                 (stays) FAILED ◄──────────── FAILED
 *                                                                │
 *                                operator suspension ──► SUSPENDED ──resume──► ACTIVE*
 *                                (* resume re-validates at the provider first)
 *
 *   Any status ──remove──► row DELETED (audit log keeps the history).
 *
 * TRUTH RULES (project-wide, non-negotiable):
 *   - Only ACTIVE domains are served by the tenant resolver.
 *   - ACTIVE is set ONLY when ownership (TXT), provider assignment, DNS
 *     configuration AND an HTTPS probe all succeeded. A failing provider
 *     API call is an error, never a downgrade to a fake success.
 *   - A provider losing the domain (removed at the provider, verification
 *     revoked) downgrades the row to FAILED — provider failures never
 *     leave misleading ACTIVE records.
 */

export const DOMAIN_STATUSES = [
  'PENDING',
  'VERIFICATION_FAILED',
  'VERIFIED',
  'PENDING_DNS',
  'PENDING_SSL',
  'ACTIVE',
  'FAILED',
  'SUSPENDED',
] as const

export type DomainStatus = (typeof DOMAIN_STATUSES)[number]

/** Statuses that prove ownership (TXT verified) — isVerified is synced to this. */
export const OWNERSHIP_VERIFIED_STATUSES: readonly DomainStatus[] = [
  'VERIFIED',
  'PENDING_DNS',
  'PENDING_SSL',
  'ACTIVE',
  'FAILED',
]

/** Statuses in which the domain is attached (or being attached) to a provider. */
export const PROVIDER_ASSIGNED_STATUSES: readonly DomainStatus[] = [
  'PENDING_DNS',
  'PENDING_SSL',
  'ACTIVE',
  'FAILED',
]

/** Statuses a background/dashboard recheck may inspect at the provider. */
export const RECHECKABLE_STATUSES: readonly DomainStatus[] = [
  'PENDING_DNS',
  'PENDING_SSL',
  'ACTIVE',
  'FAILED',
]

export function isDomainStatus(value: string): value is DomainStatus {
  return (DOMAIN_STATUSES as readonly string[]).includes(value)
}

/** Ownership proven? (drives the isVerified compatibility flag). */
export function ownershipVerified(status: string): boolean {
  return (OWNERSHIP_VERIFIED_STATUSES as readonly string[]).includes(status)
}

/** May the tenant resolver serve this hostname? (ACTIVE only — by design). */
export function servesTraffic(status: string): boolean {
  return status === 'ACTIVE'
}

/** Is this a status a recheck (provider inspect + HTTPS probe) may run on? */
export function isRecheckable(status: string): boolean {
  return (RECHECKABLE_STATUSES as readonly string[]).includes(status)
}

/**
 * Human-readable label + tone for the dashboard. `tone` maps to the badge
 * palette: 'green' success, 'blue' progress, 'amber' waiting/attention,
 * 'red' failure, 'gray' neutral/operator state.
 */
export function statusLabel(status: string): { label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'gray' } {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending verification', tone: 'amber' }
    case 'VERIFICATION_FAILED':
      return { label: 'Verification failed — retry', tone: 'red' }
    case 'VERIFIED':
      return { label: 'Verified — connect hosting', tone: 'blue' }
    case 'PENDING_DNS':
      return { label: 'Pending DNS', tone: 'amber' }
    case 'PENDING_SSL':
      return { label: 'DNS ok — SSL provisioning', tone: 'amber' }
    case 'ACTIVE':
      return { label: 'Active', tone: 'green' }
    case 'FAILED':
      return { label: 'Failed — retry connection', tone: 'red' }
    case 'SUSPENDED':
      return { label: 'Suspended by operator', tone: 'gray' }
    default:
      return { label: status, tone: 'gray' }
  }
}

/**
 * DNS status values (ChurchDomain.dnsStatus) — the provider's view of the
 * DNS configuration for the domain.
 */
export const DNS_STATUSES = ['PENDING', 'OK', 'ERROR'] as const
export type DnsStatus = (typeof DNS_STATUSES)[number]

/** SSL status values (ChurchDomain.sslStatus). */
export const SSL_STATUSES = ['PENDING', 'PROVISIONING', 'ACTIVE', 'MANAGED_BY_HOST', 'UNKNOWN'] as const
export type SslStatus = (typeof SSL_STATUSES)[number]

/**
 * The www↔apex companion of a hostname, when one exists:
 * "www.gracecommunity.org" ↔ "gracecommunity.org". Only the plain apex and
 * its www label are treated as companions; deeper subdomains have none.
 */
export function apexWwwCompanion(hostname: string): string | null {
  const labels = hostname.split('.')
  if (labels.length < 2) return null
  if (labels[0] === 'www') return labels.slice(1).join('.')
  if (labels.length === 2) return `www.${hostname}`
  return null
}
