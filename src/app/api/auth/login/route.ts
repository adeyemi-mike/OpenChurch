import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { createSession, verifyPassword } from '@/lib/auth/session'
import { cleanupExpiredAuthArtifacts } from '@/lib/auth/maintenance'
import { isDemoModeEnabled } from '@/lib/demo-mode'
import { route, ok, parseBody, ApiError } from '@/lib/api/handler'
import { loginSchema } from '@/lib/validation/onboarding'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

/** Dummy hash for constant-ish timing on unknown accounts. */
const DUMMY_BCRYPT_HASH =
  '$2b$11$Ku9Rq1Z8Y0dQm3nKwJ0h6uQ2pV6vC0Y6tG8xJ2nD5cS1eH7bA9fWu'

export const POST = route(async (req: NextRequest) => {
  const ip = clientIp(req.headers)
  // Fixed window: 10 attempts per 15 minutes per IP.
  const limit = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(
      429,
      `Too many sign-in attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
      'RATE_LIMITED'
    )
  }

  const { email, password } = await parseBody(req, loginSchema)

  // Per-ACCOUNT throttle (same window/budget as the IP limit): a distributed
  // attacker rotating IPs against one victim's email is still capped at 10
  // attempts / 15 min. The key is the email string itself, applied identically
  // whether or not the account exists — no enumeration signal. Successful
  // sign-ins also consume budget; the 30-day session makes that a non-issue
  // for humans.
  const accountLimit = rateLimit(`login:acct:${email.toLowerCase()}`, 10, 15 * 60 * 1000)
  if (!accountLimit.allowed) {
    await verifyPassword(password, DUMMY_BCRYPT_HASH)
    throw new ApiError(
      429,
      `Too many sign-in attempts. Try again in ${accountLimit.retryAfterSeconds} seconds.`,
      'RATE_LIMITED'
    )
  }

  const user = await db.user.findUnique({ where: { email } })
  // Generic error message — never reveal whether the email exists.
  const invalid = new ApiError(401, 'Incorrect email or password.', 'INVALID_CREDENTIALS')
  if (!user) {
    // Constant-ish time: still run a bcrypt compare against a dummy hash.
    await verifyPassword(password, DUMMY_BCRYPT_HASH)
    throw invalid
  }
  // Server-side demonstration gate: accounts created by the demo seed are
  // rejected when demonstration mode is off. The response is identical to a
  // wrong-password failure — the caller learns nothing about the account.
  // (Live demo sessions are also invalidated in getSessionUser.)
  if (user.isDemo && !isDemoModeEnabled()) {
    await verifyPassword(password, user.passwordHash)
    throw invalid
  }
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw invalid

  await createSession(user.id)
  await recordAudit({
    actorUserId: user.id,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.userLogin,
    entityType: 'user',
    entityId: user.id,
  })

  // Opportunistic housekeeping: prune expired sessions/reset tokens on ~5%
  // of logins so deployments without the cron endpoint still stay clean.
  if (Math.random() < 0.05) {
    await cleanupExpiredAuthArtifacts().catch(() => undefined)
  }

  return ok({ id: user.id, name: user.name, email: user.email })
})
