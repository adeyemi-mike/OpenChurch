import 'server-only'
import { db } from '@/lib/db'

/**
 * Housekeeping for authentication artifacts. Safe to run at any time.
 *
 * - Expired sessions are deleted. Expiry has always been *enforced* on
 *   access, but rows for sessions that are never presented again were
 *   previously only cleaned lazily — they accumulated forever.
 * - Password-reset tokens are purged 24h after expiry (a short grace
 *   window keeps recent token hashes inspectable for abuse forensics).
 *
 * Invoked from the hourly domain-maintenance cron and opportunistically
 * after login, so both scheduled and busy deployments stay clean.
 */
export async function cleanupExpiredAuthArtifacts(): Promise<{
  sessions: number
  resetTokens: number
}> {
  const now = new Date()
  const sessions = await db.session.deleteMany({
    where: { expiresAt: { lt: now } },
  })
  const tokenCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const resetTokens = await db.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: tokenCutoff } },
  })
  return { sessions: sessions.count, resetTokens: resetTokens.count }
}
