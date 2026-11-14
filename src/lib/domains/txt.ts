import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { resolveTxt } from 'dns/promises'
import { txtRecordName } from './validate'

/**
 * Domain-ownership verification via a DNS TXT challenge.
 *
 * SECURITY MODEL
 * --------------
 * - The token is 256 bits of CSPRNG output; only its SHA-256 hash is stored.
 *   A database leak therefore does not expose usable verification tokens.
 * - A domain is verified ONLY by a server-side DNS lookup that finds the
 *   exact token in the TXT record set. A user clicking "verify" never
 *   flips the flag by itself.
 * - Tokens expire (72h) and can be regenerated; regeneration invalidates
 *   the old token hash, so a leaked token cannot be used later.
 * - Comparison is constant-time on the digests.
 *
 * The DNS resolver is injectable so tests can exercise the full logic
 * without touching the network.
 */

export const TXT_PREFIX = 'openchurch-verify='
/** How long a verification token stays valid. */
export const TOKEN_TTL_MS = 72 * 60 * 60 * 1000

/** DNS TXT resolver signature (dns.promises.resolveTxt compatible). */
export type TxtResolver = (name: string) => Promise<string[][]>

export function defaultTxtResolver(name: string): Promise<string[][]> {
  return resolveTxt(name)
}

/** Generate a fresh verification token (plain value for DNS + dashboard). */
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex')
}

/** SHA-256 hash of a token — the only form persisted in the database. */
export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const da = createHash('sha256').update(a).digest()
  const db = createHash('sha256').update(b).digest()
  return timingSafeEqual(da, db)
}

export type TxtCheckResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Look up the ownership TXT record for a domain and check it carries the
 * expected token. DNS TXT records may split long values into multiple
 * character-strings; each record's strings are joined before comparison.
 */
export async function checkOwnershipTxt(
  domain: string,
  token: string,
  resolver: TxtResolver = defaultTxtResolver
): Promise<TxtCheckResult> {
  const name = txtRecordName(domain)
  let records: string[][]
  try {
    records = await resolver(name)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENODATA' || code === 'ENOTFOUND') {
      return { ok: false, reason: `No TXT record found at ${name} yet — DNS can take a few minutes to propagate.` }
    }
    if (code === 'ETIMEOUT' || code === 'ESERVFAIL') {
      return { ok: false, reason: 'The DNS lookup timed out — try again in a moment.' }
    }
    return { ok: false, reason: 'The DNS lookup failed — try again in a moment.' }
  }
  for (const record of records) {
    // resolveTxt returns string[][] — each inner array is one record's
    // character-strings, which must be concatenated.
    const value = (record ?? []).join('')
    if (value.startsWith(TXT_PREFIX) && safeEqual(value.slice(TXT_PREFIX.length), token)) {
      return { ok: true }
    }
  }
  return {
    ok: false,
    reason: `The TXT record at ${name} does not carry the expected value yet — DNS can take a few minutes to propagate.`,
  }
}
