/**
 * Custom-domain hostname validation and normalisation.
 *
 * Pure functions (no I/O) — unit-tested in tests/domains-validate.test.ts.
 * The rules are deliberately conservative: a custom domain is a hostname a
 * church proves it owns via DNS; anything that is not a clearly public DNS
 * hostname (IPs, localhost, ports, paths, non-ASCII, internal suffixes,
 * hosting-platform suffixes, the platform's own domains) is rejected.
 */

/** Hostname labels: 1–63 chars, alnum + hyphen, no leading/trailing hyphen. */
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Suffixes a church must never claim: the platform's own hosting providers
 * and shared PaaS/DB domains. Claiming e.g. "open-church-one.vercel.app"
 * would hijack the deployment itself or another customer's subdomain.
 * The deployment's configured origin is blocked separately at runtime.
 */
const BLOCKED_SUFFIXES: readonly string[] = [
  // Hosting platforms (the deployment itself or neighbours on the platform)
  'vercel.app',
  'vercel.dev',
  'netlify.app',
  'netlify.com',
  'space-z.ai',
  'space-z.dev',
  'neon.tech',
  'neon.build',
  'railway.app',
  'render.com',
  'onrender.com',
  'fly.dev',
  'herokuapp.com',
  'herokudns.com',
  'azurewebsites.net',
  'cloudapp.net',
  'web.app',
  'firebaseapp.com',
  'pages.dev',
  'workers.dev',
  'trycloudflare.com',
  'fcapp.run',
  // Internal-only suffixes
  'local',
  'internal',
  'localhost',
  'test',
  'example',
  'invalid',
]

export type DomainValidation =
  | { ok: true; domain: string }
  | { ok: false; error: string }

/**
 * Normalise and validate a user-supplied custom domain.
 *
 * Accepts "www.gracecommunity.org" style hostnames (with or without a
 * trailing dot or protocol prefix); rejects everything that is not a
 * registrable public hostname.
 */
export function validateCustomDomain(raw: string): DomainValidation {
  let input = (raw ?? '').trim().toLowerCase()
  if (!input) return { ok: false, error: 'Enter a domain name.' }

  // Tolerate a pasted full URL — but only http(s); anything else (ftp:,
  // javascript:, data:) is rejected as an unsafe host value.
  if (input.includes('://')) {
    try {
      const u = new URL(input)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        return { ok: false, error: 'Only http(s) domain URLs are supported.' }
      }
      input = u.hostname
    } catch {
      return { ok: false, error: 'That does not look like a valid domain.' }
    }
  }

  // Strip one trailing dot (FQDN form) and any path/query/fragment garbage.
  input = input.replace(/\.$/, '')
  if (/[/\s?#@]/.test(input)) {
    return { ok: false, error: 'Enter only the domain name — no paths or spaces.' }
  }
  // Reject anything with a port (":8080") — hostname only.
  if (input.includes(':')) {
    return { ok: false, error: 'Enter the domain without a port.' }
  }
  // ASCII only; internationalised domains must be provided in punycode form.
  if (/[^\x20-\x7e]/.test(input)) {
    return { ok: false, error: 'Use the ASCII/punycode form of the domain (e.g. xn--…).' }
  }
  if (input.length > 253) {
    return { ok: false, error: 'That domain is too long.' }
  }

  // Must be a multi-label hostname (contains a dot) — single labels like
  // "gracecommunity" are not claimable domains.
  if (!input.includes('.')) {
    return { ok: false, error: 'Enter a full domain such as gracecommunity.org.' }
  }

  const labels = input.split('.')
  if (!labels.every((l) => LABEL_RE.test(l))) {
    return { ok: false, error: 'That does not look like a valid domain name.' }
  }

  // Reject raw IP addresses (v4; v6 would already fail the label regex).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(input)) {
    return { ok: false, error: 'IP addresses cannot be used as custom domains.' }
  }

  // Block internal / platform suffixes.
  for (const suffix of BLOCKED_SUFFIXES) {
    if (input === suffix || input.endsWith(`.${suffix}`)) {
      return {
        ok: false,
        error: 'Hosting-platform and internal addresses cannot be added as custom domains — use your own domain.',
      }
    }
  }

  // Block the deployment's own configured origin(s) at runtime.
  for (const envVar of ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_APP_URL', 'PLATFORM_ROOT_DOMAIN']) {
    const configured = (process.env[envVar] ?? '').trim().toLowerCase()
    if (!configured) continue
    let host = configured
    try {
      if (configured.includes('://')) host = new URL(configured).hostname
      host = host.replace(/:\d+$/, '').replace(/\.$/, '')
    } catch {
      continue
    }
    if (host && (input === host || input.endsWith(`.${host}`))) {
      return { ok: false, error: 'That domain belongs to this platform and cannot be added as a church domain.' }
    }
  }

  return { ok: true, domain: input }
}

/**
 * The DNS name queried for the ownership TXT record:
 * `_openchurch-verify.<domain>`.
 */
export function txtRecordName(domain: string): string {
  return `_openchurch-verify.${domain}`
}
