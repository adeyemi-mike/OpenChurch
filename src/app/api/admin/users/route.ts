import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { route, ok, requirePlatformAdmin, parseBody, ApiError } from '@/lib/api/handler'
import { rateLimit } from '@/lib/rate-limit'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'

const deleteUserSchema = z.object({
  email: z.string().email(),
  confirmEmail: z.string().email(),
  action: z.literal('delete-user'),
})

/**
 * Platform-administrator account tools (data-subject requests):
 *
 * - GET  /api/admin/users?email=…  → full account export (profile,
 *   memberships, audit metadata counts — never password hashes or tokens).
 * - POST /api/admin/users { action:'delete-user' } → irreversible account
 *   deletion. Refused while the account OWNS any church (an ownerless church
 *   would be administratively orphaned) — the operator must transfer
 *   ownership or delete the church first (see /api/admin/churches).
 *
 * Both endpoints require typing the account's email twice (confirmEmail must
 * match) and are rate-limited + audited.
 */
export const GET = route(async (req: NextRequest) => {
  const admin = await requirePlatformAdmin()
  const limit = rateLimit(`admin-users:${admin.id}`, 60, 60 * 60 * 1000)
  if (!limit.allowed) throw new ApiError(429, 'Too many requests — try again later.', 'RATE_LIMITED')

  const email = new URL(req.url).searchParams.get('email')?.trim().toLowerCase()
  if (!email) throw new ApiError(400, 'Provide ?email= to look up an account.', 'MISSING_EMAIL')

  const user = await db.user.findUnique({
    where: { email },
    include: {
      memberships: { include: { church: { select: { slug: true, name: true, status: true } } } },
    },
  })
  if (!user) throw new ApiError(404, 'No account with that email.', 'NOT_FOUND')

  const [sessionCount, resetTokenCount] = await Promise.all([
    db.session.count({ where: { userId: user.id } }),
    db.passwordResetToken.count({ where: { userId: user.id } }),
  ])

  await recordAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: AUDIT_ACTIONS.userExported,
    entityType: 'user',
    entityId: user.id,
    metadata: { subjectEmail: email },
  })

  const payload = {
    format: 'openchurch.account-export/v1',
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: user.isPlatformAdmin,
      isDemo: user.isDemo,
      emailVerified: user.emailVerified,
      acceptedTermsVersion: user.acceptedTermsVersion,
      acceptedTermsAt: user.acceptedTermsAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      memberships: user.memberships.map((m) => ({
        churchSlug: m.church.slug,
        churchName: m.church.name,
        churchStatus: m.church.status,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      })),
      activeSessions: sessionCount,
      outstandingResetTokens: resetTokenCount,
    },
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="openchurch-account-${user.id.slice(0, 8)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
})

export const POST = route(async (req: NextRequest) => {
  const admin = await requirePlatformAdmin()
  const limit = rateLimit(`admin-users:${admin.id}`, 20, 60 * 60 * 1000)
  if (!limit.allowed) throw new ApiError(429, 'Too many requests — try again later.', 'RATE_LIMITED')

  const input = await parseBody(req, deleteUserSchema)
  const email = input.email.trim().toLowerCase()
  if (email !== input.confirmEmail.trim().toLowerCase()) {
    throw new ApiError(400, 'The two email addresses do not match.', 'CONFIRM_MISMATCH')
  }
  if (email === admin.email.toLowerCase()) {
    throw new ApiError(400, 'You cannot delete your own account.', 'SELF_DELETE')
  }

  const user = await db.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { role: 'OWNER' },
        include: { church: { select: { slug: true, name: true } } },
      },
    },
  })
  if (!user) throw new ApiError(404, 'No account with that email.', 'NOT_FOUND')

  if (user.memberships.length > 0) {
    // An ownerless church cannot be administered; refuse and explain.
    throw new ApiError(
      409,
      `This account owns ${user.memberships.length} church(es): ${user.memberships
        .map((m) => m.church.name)
        .join(', ')}. Transfer ownership or delete the churches first.`,
      'USER_OWNS_CHURCHES'
    )
  }

  // Cascades: sessions, reset tokens and non-owner memberships go with the
  // account. Pages the user authored keep their data (FK is SetNull).
  await db.user.delete({ where: { id: user.id } })

  await recordAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: AUDIT_ACTIONS.userDeleted,
    entityType: 'user',
    entityId: user.id,
    metadata: { subjectEmail: email },
  })

  return ok({ deleted: true })
})
