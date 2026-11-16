import 'server-only'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser, type SessionUser } from '@/lib/auth/session'
import { isValidChurchRole, type ChurchRole } from '@/lib/permissions'

/**
 * Server-side guards used by server components (page/layout) to enforce
 * authentication, membership and tenant scoping before any data is fetched.
 */

export type ChurchContext = {
  user: SessionUser
  church: {
    id: string
    slug: string
    name: string
    status: string
    isPublished: boolean
    isDemo: boolean
    onboardingCompleted: boolean
    onboardingStep: number
  }
  role: ChurchRole
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}

/** Load the user's church memberships (for the church picker). */
export async function getUserMemberships(userId: string) {
  return db.churchMembership.findMany({
    where: { userId },
    include: { church: { select: { id: true, slug: true, name: true, isPublished: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Resolve a church by slug and verify the current user is a member.
 * Returns null when the church does not exist OR the user has no membership —
 * callers must treat both identically to avoid leaking tenant existence.
 */
export async function getChurchContext(
  slug: string,
  user: SessionUser
): Promise<ChurchContext | null> {
  const membership = await db.churchMembership.findFirst({
    where: { church: { slug }, userId: user.id },
    include: {
      church: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          isPublished: true,
          isDemo: true,
          onboardingCompleted: true,
          onboardingStep: true,
        },
      },
    },
  })
  if (!membership) return null
  if (!isValidChurchRole(membership.role)) return null
  return {
    user,
    church: membership.church,
    role: membership.role,
  }
}

/** Guard for dashboard pages: redirects to login or the dashboard picker. */
export async function requireChurchContext(slug: string): Promise<ChurchContext> {
  const user = await requireUser()
  const ctx = await getChurchContext(slug, user)
  if (!ctx) redirect('/console')
  if (ctx.church.status === 'SUSPENDED' && ctx.role !== 'OWNER') {
    redirect('/console?error=suspended')
  }
  return ctx
}
