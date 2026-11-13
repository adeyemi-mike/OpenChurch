import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { isDemoModeEnabled } from '@/lib/demo-mode'

/**
 * Session-based authentication.
 *
 * - Passwords are hashed with bcrypt (cost 11).
 * - Session tokens are 256-bit random values; only a SHA-256 hash is stored
 *   in the database, so a database leak does not expose usable sessions.
 * - The cookie is httpOnly + SameSite=Lax (Strict breaks normal top-level
 *   navigation from email links; Lax still blocks cross-site POSTs).
 * - All cookie writes happen inside Route Handlers / Server Actions.
 */

export const SESSION_COOKIE = 'openchurch_session'
const SESSION_TTL_DAYS = 30
const BCRYPT_ROUNDS = 11

export type SessionUser = {
  id: string
  email: string
  name: string
  isPlatformAdmin: boolean
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  await db.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  jar.delete(SESSION_COOKIE)
}

/** Returns the authenticated user, or null. Validated against the database. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  // Demonstration accounts are authenticated only while server-side demo
  // mode is enabled. If the operator disables DEMO_MODE, any live demo
  // session (including the seeded platform-admin account) becomes
  // unauthenticated immediately — the flag is checked per request, never
  // cached client-side.
  if (session.user.isDemo && !isDemoModeEnabled()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isPlatformAdmin: session.user.isPlatformAdmin,
  }
}
