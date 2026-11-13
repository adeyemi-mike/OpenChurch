import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, parseBody, ApiError } from '@/lib/api/handler'
import { publicSubmissionSchema } from '@/lib/validation/entities'
import { rateLimit, clientIp } from '@/lib/rate-limit'

/**
 * Public form submission endpoint (contact, prayer, counselling, testimony,
 * visitor follow-up).
 *
 * Protections: per-IP rate limiting, Zod validation, a honeypot field and
 * form-active checks. Submissions are never published to the public website;
 * prayer/counselling requests are flagged sensitive and access-restricted.
 */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params

  const ip = clientIp(req.headers)
  // 5 submissions per 10 minutes per IP.
  const limit = rateLimit(`submit:${ip}`, 5, 10 * 60 * 1000)
  if (!limit.allowed) {
    throw new ApiError(
      429,
      `You are sending messages too quickly. Please wait ${limit.retryAfterSeconds}s and try again.`,
      'RATE_LIMITED'
    )
  }

  const body = await parseBody(req, publicSubmissionSchema)

  // Honeypot filled → silently accept without storing (bots see success).
  if (body.company) {
    return ok({ received: true })
  }

  const church = await db.church.findFirst({
    where: { slug, status: 'ACTIVE', isPublished: true },
    select: { id: true },
  })
  if (!church) throw new ApiError(404, 'Church not found.', 'NOT_FOUND')

  const form = await db.form.findFirst({
    where: { churchId: church.id, type: body.type, isActive: true },
    select: { id: true },
  })
  if (!form) {
    throw new ApiError(404, 'This form is not accepting submissions.', 'FORM_CLOSED')
  }

  const sensitive = body.type === 'PRAYER' || body.type === 'COUNSELLING'

  await db.formSubmission.create({
    data: {
      churchId: church.id,
      formId: form.id,
      type: body.type,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      subject: body.subject || null,
      // We store the message but never log it — see SECURITY.md.
      message: body.message,
      isSensitive: sensitive,
      status: 'NEW',
    },
  })

  return ok({ received: true }, { status: 201 })
})
