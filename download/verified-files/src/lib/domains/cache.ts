import 'server-only'

/**
 * Hostname → tenant resolution cache.
 *
 * Used by the proxy/middleware and the tenant resolver so a custom-domain
 * request does not hit the database on every hit. Safety rules:
 *
 * - TTL is short (60s) and applies to POSITIVE **and** NEGATIVE entries
 *   alike: a removed or re-assigned domain stops resolving within a minute
 *   even on instances that missed the invalidation event.
 * - Negative results (unknown hosts) are cached too so they cannot hammer
 *   the database.
 * - Keys are exact hostnames — no partial matching, so one tenant's host
 *   can never collide with another's.
 * - Invalidation is process-local: multi-instance deployments (serverless)
 *   rely on the TTL. This is documented in DEPLOYMENT.md.
 */

const TTL_MS = 60_000
const MAX_ENTRIES = 500

type Resolved = { churchId: string; slug: string }
type Entry = { value: Resolved | null; expiresAt: number }

const cache = new Map<string, Entry>()

export function getCachedHostResolution(host: string): Resolved | null | undefined {
  const key = host.toLowerCase()
  const hit = cache.get(key)
  if (!hit) return undefined
  if (hit.expiresAt < Date.now()) {
    cache.delete(key)
    return undefined
  }
  return hit.value
}

export function setCachedHostResolution(host: string, value: Resolved | null): void {
  const key = host.toLowerCase()
  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    // Simple eviction: drop the oldest key (Map preserves insertion order).
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS })
}

/** Invalidate one host (called when that domain changes). */
export function invalidateHost(host: string): void {
  cache.delete(host.toLowerCase())
}

/** Invalidate everything (called after any domain mutation we cannot map to one host). */
export function invalidateAllHosts(): void {
  cache.clear()
}
