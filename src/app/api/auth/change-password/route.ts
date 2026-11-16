import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser, hashPassword, verifyPassword, SESSION_COOKIE } from '@/lib/auth/session'
import { route, ok, parseBody, ApiError } from '@/lib/api/handler'
import { passwordSchema } from '@/lib/validation/onboarding'
import { rateLimit } from '@/lib/rate-limit'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { createHash } from 'crypto'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: passwordSchema,
})

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Authenticated password change (any signed-in account, from the console
 * profile page).
 *
 * - Requires the CURRENT password (session hijacker cannot silently rotate
 *   the victim's credentials).
 * - New password must satisfy the platform password policy.
 * - All OTHER sessions are revoked; the current session stays signed in.
 * - Rate limited per account. Audited (no passwords in the audit payload).
 */
export const POST = route(async (req: NextRequest) => {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, 'You need to sign in to continue.', 'UNAUTHENTICATED')

  const limit = rateLimit(`change-password:${user.id}`, 5, 60 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(
      429,
      `Too many password changes. Try again in ${limit.retryAfterSeconds} seconds.`,
      'RATE_LIMITED'
    )
  }

  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema)

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  })
  if (!row) throw new ApiError(404, 'Account not found.', 'NOT_FOUND')

  const valid = await verifyPassword(currentPassword, row.passwordHash)
  if (!valid) {
    throw new ApiError(403, 'Your current password is incorrect.', 'INVALID_CURRENT_PASSWORD')
  }

  const newHash = await hashPassword(newPassword)
  const currentToken = req.cookies.get(SESSION_COOKIE)?.value
  const keepHash = currentToken ? hashToken(currentToken) : null

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }),
    // Revoke every OTHER session (keep this one so the user stays signed in).
    ...(keepHash
      ? [db.session.deleteMany({ where: { userId: user.id, tokenHash: { not: keepHash } } })]
      : [db.session.deleteMany({ where: { userId: user.id } })]),
  ])

  await recordAudit({
    actorUserId: user.id,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.userPasswordChanged,
    entityType: 'user',
    entityId: user.id,
  })

  return ok({ changed: true })
})
