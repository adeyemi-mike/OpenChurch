import 'server-only'

/**
 * Custom-domain CAPABILITY of the current deployment.
 *
 * OpenChurch supports custom domains in two deployment models, and the
 * platform must be honest about which one it is running as:
 *
 * 1. MANAGED HOSTING (mode "managed-auto")
 *      Church owners connect and manage domains entirely from the
 *      dashboard: add, TXT ownership verification, automated hosting
 *      assignment through the provider API (e.g. Vercel with
 *      VERCEL_TOKEN + VERCEL_PROJECT_ID), provider-reported DNS records,
 *      SSL status and primary-domain selection.
 *
 * 2. SELF-HOSTED INSTALLATION (mode "self-hosted")
 *      Administrators configure DNS and subdomain routing on infrastructure
 *      they control (docs/DEPLOYMENT.md). Owners verify ownership in the
 *      dashboard, point the domain at their server, and confirm the
 *      connection manually — the dashboard labels that status
 *      "owner-confirmed" because no provider API confirms it.
 *
 * 3. UNAVAILABLE (mode "unavailable")
 *      Serverless hosting WITHOUT the provider integration (the hosted
 *      demonstration falls here): there is no fixed server address to point
 *      DNS at and no API through which the platform can complete the
 *      hosting-provider assignment. Offering a manual "point DNS at this
 *      server" workflow would be a false promise, so the dashboard reports
 *      domains as unavailable and explains the limitation instead. The
 *      platform path (/church/<slug>) keeps working everywhere.
 *
 * The derivation runs on EVERY call (not at module load) so configuration
 * changes take effect without a rebuild and tests can simulate hosts.
 */

export type DomainCapabilityMode = 'managed-auto' | 'self-hosted' | 'unavailable'

export type DomainCapability = {
  mode: DomainCapabilityMode
  /** True when hosting assignment can be automated from the dashboard. */
  automated: boolean
  /** One-sentence explanation for UI text and API payloads. */
  summary: string
}

const SUMMARIES: Record<DomainCapabilityMode, string> = {
  'managed-auto':
    'Managed hosting with automated domain assignment: the dashboard attaches your domain to the hosting provider, shows the provider-required DNS records and reports provider-verified status.',
  'self-hosted':
    'Self-hosted deployment: verify ownership with a DNS TXT record, point your domain at this server and configure the reverse proxy (docs/DEPLOYMENT.md), then confirm in the dashboard.',
  unavailable:
    'Domain connection is not available on this deployment: it runs on managed hosting without the domain-assignment integration, so the platform cannot complete the required configuration. Custom domains are supported on self-hosted installations and on managed hosting with the integration enabled.',
}

function hasVercelToken(): boolean {
  return Boolean(process.env.VERCEL_TOKEN?.trim() && process.env.VERCEL_PROJECT_ID?.trim())
}

export function getDomainCapability(): DomainCapability {
  // 1. Explicit operator override — for hosts the platform cannot
  //    auto-detect (Coolify, Fly.io, Kubernetes, …).
  //    "manual" / "off" always win (the operator knows their infrastructure);
  //    "auto" is honoured only when the provider integration is actually
  //    configured — an auto declaration without credentials falls through to
  //    the honest derived value rather than pretending automation exists.
  const explicit = process.env.CUSTOM_DOMAIN_MODE?.trim().toLowerCase()
  if (explicit === 'manual' || explicit === 'self-hosted') {
    return { mode: 'self-hosted', automated: false, summary: SUMMARIES['self-hosted'] }
  }
  if (explicit === 'off' || explicit === 'disabled' || explicit === 'unavailable') {
    return { mode: 'unavailable', automated: false, summary: SUMMARIES.unavailable }
  }

  // 2. Provider integration configured → managed hosting with automation.
  if (hasVercelToken()) {
    return { mode: 'managed-auto', automated: true, summary: SUMMARIES['managed-auto'] }
  }

  // 3. Serverless hosting without the integration (Vercel sets VERCEL=1 in
  //    every runtime): manual DNS instructions would be false promises.
  if (process.env.VERCEL === '1') {
    return { mode: 'unavailable', automated: false, summary: SUMMARIES.unavailable }
  }

  // 4. Default: an always-on server the operator controls (Docker, Node host,
  //    VM). The manual workflow is legitimate here.
  return { mode: 'self-hosted', automated: false, summary: SUMMARIES['self-hosted'] }
}

/**
 * True when the domain workflow (add / verify / connect / primary) is
 * operable on this deployment. Removal and listing are always available.
 */
export function domainsOperable(capability = getDomainCapability()): boolean {
  return capability.mode !== 'unavailable'
}
