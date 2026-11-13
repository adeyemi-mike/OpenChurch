import { type NextRequest } from 'next/server'
import { route, ok, parseBody, ApiError } from '@/lib/api/handler'
import { resetPasswordSchema } from '@/lib/validation/onboarding'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { hashPassword } from '@/lib/auth/session'
import { consumePasswordResetToken } from '@/lib/auth/password-reset'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

/**
 * Password recovery — step 2: consume a single-use token and set a new
 * password. Rate limited per IP; every existing session of the user is
 * revoked on success (see password-reset.ts).
 */
export const POST = route(async (req: NextRequest) => {
  const ip = clientIp(req.headers)
  const limit = rateLimit(`reset:${ip}`, 10, 60 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(429, 'Too many attempts. Please try again later.', 'RATE_LIMITED')
  }

  const { token, password } = await parseBody(req, resetPasswordSchema)

  const { validatePasswordResetToken } = await import('@/lib/auth/password-reset')
  const userIdForAudit = await validatePasswordResetToken(token)

  const success = await consumePasswordResetToken(token, await hashPassword(password))
  if (!success) {
    throw new ApiError(
      400,
      'This password reset link is invalid or has expired. Please request a new one.',
      'INVALID_TOKEN'
    )
  }

  if (userIdForAudit) {
    await recordAudit({
      actorUserId: userIdForAudit,
      action: AUDIT_ACTIONS.passwordResetViaEmail,
      entityType: 'user',
      entityId: userIdForAudit,
    }).catch(() => undefined)
  }

  return ok({ reset: true })
})
