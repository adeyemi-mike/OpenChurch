/**
 * Simple in-memory FIXED-WINDOW rate limiter for public endpoints
 * (form submissions, login attempts).
 *
 * The window starts at the first hit and resets wholesale when it elapses,
 * so a caller can burst up to ~2x `max` across a window boundary. Suitable
 * for a single-instance deployment. For horizontal scaling swap the store
 * for Redis — the interface (`rateLimit(key, max, windowMs)`) stays the
 * same. Documented in docs/DEPLOYMENT.md.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
  remaining: number
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0, remaining: max - 1 }
  }
  if (bucket.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    }
  }
  bucket.count += 1
  return { allowed: true, retryAfterSeconds: 0, remaining: max - bucket.count }
}

/** Best-effort client IP behind the sandbox gateway / a reverse proxy. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
