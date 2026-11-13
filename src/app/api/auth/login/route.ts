import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { createSession, verifyPassword } from '@/lib/auth/session'
import { isDemoModeEnabled } from '@/lib/demo-mode'
import { route, ok, parseBody, ApiError } from '@/lib/api/handler'
import { loginSchema } from '@/lib/validation/onboarding'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

export const POST = route(async (req: NextRequest) => {
  const ip = clientIp(req.headers)
  // Sliding window: 10 attempts per 15 minutes per IP.
  const limit = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(
      429,
      `Too many sign-in attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
      'RATE_LIMITED'
    )
  }

  const { email, password } = await parseBody(req, loginSchema)

  const user = await db.user.findUnique({ where: { email } })
  // Generic error message — never reveal whether the email exists.
  const invalid = new ApiError(401, 'Incorrect email or password.', 'INVALID_CREDENTIALS')
  if (!user) {
    // Constant-ish time: still run a bcrypt compare against a dummy hash.
    await verifyPassword(password, '$2b$11$Ku9Rq1Z8Y0dQm3nKwJ0h6uQ2pV6vC0Y6tG8xJ2nD5cS1eH7bA9fWu')
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

  return ok({ id: user.id, name: user.name, email: user.email })
})
