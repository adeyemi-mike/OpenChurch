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

/**
 * Single-use consumption + password update + session revocation.
 *
 * The single-use claim is enforced ATOMICALLY: the UPDATE below matches the
 * token row only while it is still unused and unexpired, so two concurrent
 * requests with the same token cannot both succeed — the loser claims zero
 * rows and gets `false`. (The pre-check in `validatePasswordResetToken`
 * exists for friendly route-level errors only; it is never the enforcement.)
 */
export async function consumePasswordResetToken(
  token: string,
  newPasswordHash: string
): Promise<boolean> {
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true },
  })
  if (!record) return false

  return db.$transaction(async (tx) => {
    // Atomic claim: fails for used, expired or concurrently-consumed tokens.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    })
    if (claimed.count !== 1) return false
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash: newPasswordHash },
    })
    // Security requirement: revoke every existing session after a reset.
    await tx.session.deleteMany({ where: { userId: record.userId } })
    return true
  })
}
