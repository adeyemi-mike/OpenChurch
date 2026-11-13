import { type NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { route, ok, requirePlatformAdmin, parseBody, ApiError } from '@/lib/api/handler'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { passwordSchema, emailSchema } from '@/lib/validation/onboarding'

const resetSchema = z.object({
  email: emailSchema,
  newPassword: passwordSchema,
})

/**
 * Platform-admin password reset — the supported recovery path for instances
 * without email delivery (SMTP is optional and usually not configured).
 * All of the user's sessions are revoked so a stolen session cannot survive
 * the reset.
 */
export const POST = route(async (req: NextRequest) => {
  const admin = await requirePlatformAdmin()

  const ip = clientIp(req.headers)
  // Sliding window: 10 resets per hour per IP — plenty for real administration,
  // useless for abuse.
  const limit = rateLimit(`admin-reset:${ip}`, 10, 60 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(
      429,
      `Too many reset attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
      'RATE_LIMITED'
    )
  }

  const input = await parseBody(req, resetSchema)

  const user = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, name: true, isPlatformAdmin: true },
  })
  if (!user) {
    throw new ApiError(404, 'No account found with that email address.', 'NOT_FOUND')
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 11)

  const [, sessionsDeleted] = await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ])

  await recordAudit({
    churchId: null,
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: AUDIT_ACTIONS.platformPasswordReset,
    entityType: 'user',
    entityId: user.id,
    metadata: { targetEmail: user.email, sessionsRevoked: sessionsDeleted.count },
  })

  return ok({ email: user.email, sessionsRevoked: sessionsDeleted.count })
})
