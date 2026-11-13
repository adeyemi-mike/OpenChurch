import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { db } from '@/lib/db'

/**
 * Secure password recovery tokens.
 *
 * - 256-bit random tokens; only a SHA-256 hash is stored, so a database
 *   leak does not expose usable reset links.
 * - Tokens are single-use (`usedAt`) and expire after 60 minutes.
 * - Rate limiting lives in the route handlers (per-IP), and the token
 *   request response is always generic (never reveals account existence).
 */

const TOKEN_TTL_MS = 60 * 60 * 1000
/** Max 5 outstanding tokens per user; oldest are pruned on request. */
const MAX_ACTIVE_TOKENS_PER_USER = 5

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Prune expired/consumed tokens for this user.
  await db.passwordResetToken.deleteMany({
    where: { userId, OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
  })
  const count = await db.passwordResetToken.count({ where: { userId } })
  if (count >= MAX_ACTIVE_TOKENS_PER_USER) {
    const oldest = await db.passwordResetToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: count - MAX_ACTIVE_TOKENS_PER_USER + 1,
      select: { id: true },
    })
    await db.passwordResetToken.deleteMany({ where: { id: { in: oldest.map((t) => t.id) } } })
  }

  const token = randomBytes(32).toString('hex')
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  })
  return token
}

/** Returns the token's user id, or null when invalid/expired/already used. */
export async function validatePasswordResetToken(token: string): Promise<string | null> {
  if (!token) return null
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  })
  if (!record) return null
  if (record.usedAt) return null
  if (record.expiresAt < new Date()) return null
  return record.userId
}

/** Single-use consumption + password update + session revocation. */
export async function consumePasswordResetToken(
  token: string,
  newPasswordHash: string
): Promise<boolean> {
  const userId = await validatePasswordResetToken(token)
  if (!userId) return false

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true },
  })
  if (!record) return false

  await db.$transaction([
    // Mark the token used (single-use guarantee enforced atomically).
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    db.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    }),
    // Security requirement: revoke every existing session after a reset.
    db.session.deleteMany({ where: { userId } }),
  ])

  return true
}
