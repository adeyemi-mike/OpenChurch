import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok } from '@/lib/api/handler'
import { forgotPasswordSchema } from '@/lib/validation/onboarding'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { createPasswordResetToken } from '@/lib/auth/password-reset'
import { isMailConfigured, sendMail, passwordResetEmail } from '@/lib/mail'
import { getPublicOrigin } from '@/lib/url'

/**
 * Password recovery — step 1: request a reset email.
 *
 * - Rate limited per IP.
 * - ALWAYS responds generically: the response never reveals whether the
 *   account exists.
 * - When SMTP is not configured we still return a generic ok, but the UI
 *   tells the truth (see /forgot-password): no email is sent and nothing is
 *   pretended. No reset link is logged in production.
 */
export const POST = route(async (req: NextRequest) => {
  const ip = clientIp(req.headers)
  const limit = rateLimit(`forgot:${ip}`, 5, 60 * 60 * 1000)
  if (!limit.allowed) {
    return ok({ received: true, retryAfterSeconds: limit.retryAfterSeconds })
  }

  const { email } = await parseBodySilent(req)
  const user = await db.user.findUnique({ where: { email }, select: { id: true } })

  if (user && isMailConfigured()) {
    const token = await createPasswordResetToken(user.id)
    const origin = getPublicOrigin(req.headers)
    const link = `${origin}/reset-password?token=${token}`
    const mail = passwordResetEmail(link)
    await sendMail({ to: email, subject: mail.subject, text: mail.text })
  }

  return ok({ received: true })
})

/** Parse without throwing validation errors (generic-response requirement). */
async function parseBodySilent(req: NextRequest): Promise<{ email: string }> {
  try {
    const raw = (await req.json()) as unknown
    const parsed = forgotPasswordSchema.safeParse(raw)
    return parsed.success ? parsed.data : { email: '' }
  } catch {
    return { email: '' }
  }
}
