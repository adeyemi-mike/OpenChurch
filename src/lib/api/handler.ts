import 'server-only'
import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser, type SessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { isDemoModeEnabled } from '@/lib/demo-mode'
import { isValidChurchRole, can, type Permission, type ChurchRole } from '@/lib/permissions'
import { verifyCsrf, trustedOriginsFromEnv, CSRF_COOKIE, CSRF_HEADER } from '@/lib/auth/csrf'

/**
 * Centralised API plumbing: typed errors, one error-response shape for the
 * whole platform, CSRF origin verification for state-changing verbs, and a
 * tenant-scoped wrapper that every dashboard endpoint goes through.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init)
}

export function fail(status: number, message: string, code?: string): NextResponse {
  return NextResponse.json({ ok: false, error: { message, code } }, { status })
}

/** Wrap a route handler with centralised error handling. */
export function route<Args extends unknown[]>(
  handler: (req: NextRequest, ...args: Args) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: Args): Promise<NextResponse> => {
    try {
      // CSRF protection for cookie-based auth on unsafe verbs. Layered
      // verification (see src/lib/auth/csrf.ts): Origin-vs-Host first, then
      // TRUSTED_ORIGINS, then the double-submit cookie — so legitimate
      // browser requests still work behind proxies that rewrite Host,
      // while cross-site requests are rejected.
      const method = req.method.toUpperCase()
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        const verdict = verifyCsrf({
          origin: req.headers.get('origin'),
          host: req.headers.get('host'),
          xForwardedHost: req.headers.get('x-forwarded-host'),
          trustedOrigins: trustedOriginsFromEnv(),
          csrfCookie: req.cookies.get(CSRF_COOKIE)?.value ?? null,
          csrfHeader: req.headers.get(CSRF_HEADER),
        })
        if (!verdict.ok) {
          throw new ApiError(
            403,
            'Cross-site request blocked.',
            verdict.reason === 'INVALID_ORIGIN' ? 'CSRF_INVALID' : 'CSRF_BLOCKED'
          )
        }
      }
      const res = await handler(req, ...args)
      // Privacy: JSON API responses are private by default. Without an
      // explicit header the browser may heuristic-cache GET responses and
      // keep them in the back/forward cache, where they could survive a
      // logout and be re-read by the next user of the same browser profile.
      // Routes that declare their own policy (e.g. immutable media files)
      // are left untouched.
      const m = req.method.toUpperCase()
      if (
        (m === 'GET' || m === 'HEAD') &&
        !res.headers.has('Cache-Control')
      ) {
        res.headers.set('Cache-Control', 'no-store, must-revalidate')
      }
      return res
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(err.status, err.message, err.code)
      }
      console.error('[api] Unhandled error:', err)
      return fail(500, 'Something went wrong on our side. Please try again.', 'INTERNAL')
    }
  }
}

// ---------------------------------------------------------------------------
// Tenant-scoped context for dashboard APIs
// ---------------------------------------------------------------------------

export type ApiChurchContext = {
  user: SessionUser
  role: ChurchRole
  churchId: string
  churchSlug: string
  churchName: string
}

async function resolveChurchContext(
  slug: string,
  user: SessionUser
): Promise<ApiChurchContext | null> {
  const m = await db.churchMembership.findFirst({
    where: { church: { slug }, userId: user.id },
    include: { church: { select: { id: true, slug: true, name: true, status: true } } },
  })
  if (!m || !isValidChurchRole(m.role)) return null
  if (m.church.status === 'SUSPENDED') return null
  return {
    user,
    role: m.role,
    churchId: m.church.id,
    churchSlug: m.church.slug,
    churchName: m.church.name,
  }
}

/**
 * Authenticated + tenant-scoped handler wrapper.
 * Usage:
 *   export const POST = route(async (req, { params }) => {
 *     const ctx = await withChurch(params, 'content:manage', ...)
 *   })
 */
export async function withChurch<Out>(
  slug: string,
  permission: Permission,
  fn: (ctx: ApiChurchContext) => Promise<Out>
): Promise<Out | NextResponse> {
  const user = await getSessionUser()
  if (!user) return fail(401, 'You need to sign in to continue.', 'UNAUTHENTICATED')
  const ctx = await resolveChurchContext(slug, user)
  if (!ctx) return fail(404, 'Church not found.', 'NOT_FOUND')
  if (!can(ctx.role, permission)) {
    return fail(403, 'You do not have permission to perform this action.', 'FORBIDDEN')
  }
  return fn(ctx)
}

/** Same as withChurch but returns the context or throws ApiError (for handlers
 *  that prefer exceptions over early responses). */
export async function requireChurch(
  slug: string,
  permission: Permission
): Promise<ApiChurchContext> {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, 'You need to sign in to continue.', 'UNAUTHENTICATED')
  const ctx = await resolveChurchContext(slug, user)
  if (!ctx) throw new ApiError(404, 'Church not found.', 'NOT_FOUND')
  if (!can(ctx.role, permission)) {
    throw new ApiError(403, 'You do not have permission to perform this action.', 'FORBIDDEN')
  }
  return ctx
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, 'You need to sign in to continue.', 'UNAUTHENTICATED')
  if (!user.isPlatformAdmin) {
    throw new ApiError(403, 'Platform administrator access required.', 'FORBIDDEN')
  }
  // Defense in depth: demonstration accounts (including the seeded operator
  // account) never wield platform-administration privileges when demo mode
  // is off. Normally unreachable — demo users cannot sign in or hold a
  // session in that state — but this guards against any future code path
  // that authenticates users without going through the demo gate.
  if (user.isPlatformAdmin && !isDemoModeEnabled()) {
    const row = await db.user.findUnique({
      where: { id: user.id },
      select: { isDemo: true },
    })
    if (row?.isDemo) {
      throw new ApiError(403, 'Platform administrator access required.', 'FORBIDDEN')
    }
  }
  return user
}

/** Parse and validate a JSON body with Zod, producing a clean 400. */
export async function parseBody<T>(
  req: NextRequest,
  schema: z.ZodType<T>
): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body.', 'BAD_JSON')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const where = first?.path?.length ? ` (${first.path.join('.')})` : ''
    throw new ApiError(400, `${first?.message ?? 'Invalid input.'}${where}`, 'VALIDATION')
  }
  return result.data
}
