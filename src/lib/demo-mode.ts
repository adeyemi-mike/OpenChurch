import 'server-only'

/**
 * Server-controlled demonstration mode.
 *
 * SECURITY MODEL
 * --------------
 * Demonstration mode is a SERVER-side runtime decision. The `DEMO_MODE`
 * environment variable is deliberately NOT prefixed with NEXT_PUBLIC_: a
 * client-exposed variable is readable (and spoofable-by-rebuild) in every
 * browser bundle, so it can never be the boundary that enables or disables
 * demonstration access.
 *
 * Fail-safe defaults: when the operator configures nothing, demonstration
 * mode is OFF in production and ON in development. A hosted public demo
 * opts in explicitly with DEMO_MODE=true.
 *
 * Consumers:
 *   - `src/app/login/page.tsx` (server component) — decides whether the
 *     demonstration-credentials panel is rendered at all.
 *   - `src/app/api/auth/login/route.ts` — rejects accounts flagged
 *     `isDemo` when demonstration mode is off (generic invalid-credentials
 *     response; no information leak).
 *   - `src/lib/auth/session.ts` — treats live sessions of `isDemo` users
 *     as unauthenticated when demonstration mode is off, so disabling the
 *     mode revokes effective demo access immediately.
 *   - `prisma/seed.ts` — refuses to create demonstration content unless
 *     demonstration mode is enabled (inlined copy; seed runs outside Next).
 */

export type DemoAccount = {
  email: string
  label: string
}

/** The shared demonstration password, advertised only when demo mode is on. */
export const DEMO_PASSWORD_HINT = 'Demo1234!'

/**
 * The demonstration accounts created by `prisma/seed.ts`. This list must
 * stay in sync with the seed. It NEVER includes platform-administrator
 * accounts — the seeded operator account is not advertised here.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'owner@grace.demo', label: 'Grace Community Church — Owner' },
  { email: 'editor@grace.demo', label: 'Grace Community Church — Editor' },
  { email: 'author@grace.demo', label: 'Grace Community Church — Author' },
  { email: 'owner@emmanuel.demo', label: 'Emmanuel Parish Church — Owner' },
]

/**
 * Canonical server-side decision. Reads the environment on every call so
 * operators can toggle the mode without rebuild-time inlining (the value is
 * never embedded in client JavaScript).
 *
 * NOTE for `prisma/seed.ts` and other non-Next scripts: this module imports
 * `server-only` and cannot be imported there — duplicate the 5-line rule and
 * reference this comment.
 */
export function isDemoModeEnabled(): boolean {
  const raw = (
    process.env.DEMO_MODE ??
    (process.env.NODE_ENV === 'production' ? 'false' : 'true')
  )
    .trim()
    .toLowerCase()
  return raw === 'true'
}

/** Payload the login page may render when (and only when) demo mode is on. */
export function demoModePresentation() {
  if (!isDemoModeEnabled()) return null
  return {
    accounts: DEMO_ACCOUNTS,
    passwordHint: DEMO_PASSWORD_HINT,
  }
}
