-- Custom domains v2: subscription-plan entitlements + finer-grained
-- provider lifecycle (provider reference, explicit DNS status).

-- AlterTable: per-church subscription plan (free | paid | premium). Limits
-- are operator-configured via env (DOMAIN_LIMIT_FREE/PAID/PREMIUM) and
-- enforced in lib/domains/entitlements.ts — no billing logic in the schema.
ALTER TABLE "churches" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';

-- AlterTable: the provider's own domain identifier (e.g. Vercel uid),
-- captured from provider API responses; explicit DNS status column.
ALTER TABLE "church_domains" ADD COLUMN "providerRef" TEXT,
ADD COLUMN "dnsStatus" TEXT;

-- CreateIndex: cron/background rechecks scan provider-assigned domains by
-- staleness (see /api/cron/domains).
CREATE INDEX "church_domains_provider_lastCheckedAt_idx" ON "church_domains"("provider", "lastCheckedAt");
