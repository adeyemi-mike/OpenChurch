import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createSession, hashPassword } from '@/lib/auth/session'
import { route, ok, parseBody, ApiError } from '@/lib/api/handler'
import { registerSchema } from '@/lib/validation/onboarding'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

export const POST = route(async (req: NextRequest) => {
  const ip = clientIp(req.headers)
  const limit = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(429, 'Too many registration attempts. Please try again later.', 'RATE_LIMITED')
  }

  const { name, email, password, acceptedTermsVersion } = await parseBody(
    req,
    registerSchema.extend({
      acceptedTermsVersion: z.string().trim().max(20).optional(),
    })
  )

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists. Try signing in instead.', 'EMAIL_TAKEN')
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      // Record the legal acceptance the user gave at sign-up (version +
      // timestamp), per the platform Privacy Policy.
      acceptedTermsVersion: acceptedTermsVersion ?? null,
      acceptedTermsAt: acceptedTermsVersion ? new Date() : null,
    },
  })

  await createSession(user.id)
  await recordAudit({
    actorUserId: user.id,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.userRegistered,
    entityType: 'user',
    entityId: user.id,
  })

  return ok({ id: user.id, name: user.name, email: user.email })
})
