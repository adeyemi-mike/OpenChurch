import 'server-only'
import { db } from '@/lib/db'

/**
 * Custom-domain ENTITLEMENTS (subscription-plan integration).
 *
 * Design constraints (docs/DEPLOYMENT.md "Domain plans & limits"):
 *   - No billing system and no hardcoded pricing — OpenChurch is open
 *     source; monetisation is the operator's choice.
 *   - Access to custom domains is controlled per church by a PLAN, and plan
 *     limits are configured by the platform operator via environment
 *     variables, once per deployment.
 *   - The interface is deliberately narrow (plan → limit → enforcement) so a
 *     future billing integration only has to write `Church.plan`.
 *
 * Defaults (operator-overridable):
 *   free     → 0 domains (the platform address always works)
 *   paid     → 1 domain
 *   premium  → 10 domains
 */

export const DOMAIN_PLANS = ['free', 'paid', 'premium'] as const
export type DomainPlan = (typeof DOMAIN_PLANS)[number]

export const DEFAULT_DOMAIN_LIMITS: Record<DomainPlan, number> = {
  free: 0,
  paid: 1,
  premium: 10,
}

export function normalizePlan(raw: string | null | undefined): DomainPlan {
  const v = (raw ?? '').trim().toLowerCase()
  return (DOMAIN_PLANS as readonly string[]).includes(v) ? (v as DomainPlan) : 'free'
}

/**
 * The domain limit for a plan. Operators override with
 * `DOMAIN_LIMIT_<PLAN>` (e.g. DOMAIN_LIMIT_PAID=3); values are clamped to
 * 0–100 so a typo can never grant unlimited domains.
 */
export function planDomainLimit(plan: string | null | undefined): number {
  const p = normalizePlan(plan)
  const raw = process.env[`DOMAIN_LIMIT_${p.toUpperCase()}`]
  if (raw === undefined || raw === '') return DEFAULT_DOMAIN_LIMITS[p]
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_DOMAIN_LIMITS[p]
  return Math.min(n, 100)
}

export type DomainEntitlement = {
  plan: DomainPlan
  /** Maximum connected domains for this plan (0 = custom domains not included). */
  limit: number
  /** Connected domains right now (all rows count — removal deletes rows). */
  used: number
  /** True when adding another domain is permitted by the plan. */
  canAdd: boolean
  /** Non-pricing hint shown when the limit blocks an add. */
  upgradeHint: string | null
}

export async function getDomainEntitlement(churchId: string): Promise<DomainEntitlement> {
  const [church, used] = await Promise.all([
    db.church.findUnique({ where: { id: churchId }, select: { plan: true } }),
    db.churchDomain.count({ where: { churchId } }),
  ])
  return resolveEntitlement(church?.plan ?? 'free', used)
}

/** Pure core (unit-tested): derive the entitlement from plan + usage. */
export function resolveEntitlement(plan: string | null | undefined, used: number): DomainEntitlement {
  const p = normalizePlan(plan)
  const limit = planDomainLimit(p)
  const canAdd = used < limit
  return {
    plan: p,
    limit,
    used,
    canAdd,
    upgradeHint:
      canAdd || limit > 0
        ? null
        : 'Custom domains are included with paid plans. Ask your platform operator about upgrading your church\u2019s plan.',
  }
}
