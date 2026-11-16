import { type NextRequest, after } from 'next/server'
import { db } from '@/lib/db'
import { route, ok } from '@/lib/api/handler'
import { forgotPasswordSchema } from '@/lib/validation/onboarding'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { createPasswordResetToken } from '@/lib/auth/password-reset'
import { isMailConfigured, sendMail, passwordResetEmail } from '@/lib/mail'
import { trustedConfiguredOrigin } from '@/lib/url'
import { isPlatformHost, resolveChurchByHost } from '@/lib/tenancy/resolver'

/**
 * Password recovery — step 1: request a reset email.
 *
 * - Rate limited per IP.
 * - ALWAYS responds generically: the response never reveals whether the
 *   account exists.
 * - The email is dispatched AFTER the response (next/server `after`), so the
 *   SMTP round trip can never leak account existence through response
 *   latency. Outside a request scope `after` throws and we send inline.
 * - The reset link origin must be a host this deployment owns: the
 *   configured site URL, a platform host, or one of the tenants' ACTIVE
 *   custom domains. An attacker-supplied Host/X-Forwarded-Host can never
 *   poison the emailed link.
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
    const origin = await trustedResetOrigin(req)
    if (origin) {
      const send = async () => {
        try {
          const token = await createPasswordResetToken(user.id)
          const link = `${origin}/reset-password?token=${token}`
          const mail = passwordResetEmail(link)
          await sendMail({ to: email, subject: mail.subject, text: mail.text })
        } catch (err) {
          console.error('[forgot-password] failed to send reset email', err)
        }
      }
      await sendAfterResponse(send)
    } else {
      // Untrusted Host header — refuse to email a poisoned link. The
      // response stays generic; the operator is told how to fix the config.
      console.warn(
        '[forgot-password] reset email suppressed: request host is not a trusted origin. ' +
          'Set NEXT_PUBLIC_SITE_URL (or TRUSTED_ORIGINS) on this deployment.'
      )
    }
  }

  return ok({ received: true })
})

/**
 * Dispatch work after the response has been flushed. `after` is the Next.js
 * primitive for this; when called outside a request scope it throws, and we
 * fall back to inline execution (tests, tooling).
 */
function sendAfterResponse(fn: () => Promise<void>): Promise<void> {
  try {
    after(fn)
    return Promise.resolve()
  } catch {
    return fn()
  }
}

/**
 * Origin for emailed reset links — hardened against Host-header poisoning.
 *
 * 1. The operator-configured NEXT_PUBLIC_SITE_URL always wins.
 * 2. Otherwise the request host must be a hostname this deployment owns:
 *    a platform host (localhost/dev, the configured origins, the platform
 *    root domain) or a tenant's ACTIVE custom domain (resolved through the
 *    cached tenant resolver). Anything else (an attacker-controlled Host)
 *    yields null and NO email is sent.
 */
async function trustedResetOrigin(req: NextRequest): Promise<string | null> {
  const configured = trustedConfiguredOrigin()
  if (configured) return configured

  const rawHost = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '')
    .split(',')[0]
    ?.trim()
  if (!rawHost) return null
  const hostname = rawHost.split(':')[0].toLowerCase().replace(/\.$/, '')
  if (!hostname) return null
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http'

  if (isPlatformHost(hostname)) return `${proto}://${rawHost}`
  if (proto === 'https') {
    const tenant = await resolveChurchByHost(hostname).catch(() => null)
    if (tenant) return `https://${rawHost}`
  }
  return null
}

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
