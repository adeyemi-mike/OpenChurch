#!/usr/bin/env bash
#
# Vercel build pipeline for OpenChurch.
#
# Referenced by vercel.json (buildCommand). Runs the four steps a serverless
# Postgres deployment needs, in order:
#
#   1. Flip the Prisma datasource to postgresql (repo default is sqlite so
#      a fresh clone works without any database server).
#   2. prisma generate — embeds the PostgreSQL query engine into the client.
#   3. prisma migrate deploy — applies prisma/migrations (PostgreSQL dialect)
#      to the target database. Migrations MUST run over the direct (non-
#      pooled) connection: PgBouncer-style poolers break migration locking.
#      The migration URL is resolved in this order:
#        DIRECT_URL              (explicit, works everywhere)
#        DATABASE_URL_UNPOOLED   (set automatically by the Vercel-Managed
#                                Neon integration — no manual setup needed)
#        DATABASE_URL            (fallback, fine for non-pooled databases)
#   4. next build — the standard Next.js production build (Vercel handles
#      the rest: static assets, serverless functions, edge config).
#
# Required Vercel project environment variables:
#   DATABASE_URL      pooled/runtime connection string. Set automatically by
#                     the Vercel Storage → Neon integration (PgBouncer-ready),
#                     or paste a Neon "-pooler" URL with &pgbouncer=true
#   NEXT_PUBLIC_SITE_URL  canonical public origin (https://…) — REQUIRED for
#                     this project. NEXT_PUBLIC_* values are inlined at build
#                     time, so set it in Vercel → Settings → Environment
#                     Variables before building, not only at runtime.
#   DEMO_MODE         must be "false" or unset on a real instance
#   DIRECT_URL        optional — only needed for pooled URLs on hosts that
#                     do not set DATABASE_URL_UNPOOLED
set -euo pipefail
cd "$(dirname "$0")/.."

# Serverless deployments take ALL configuration from the platform's env vars.
# Repo .env files (e.g. a leftover .env.production from a self-hosted setup,
# which may contain DEMO_MODE=true or another deployment's SITE_URL) must
# never leak into this build — remove them before next build reads them.
# Vercel-injected environment variables (process.env) always win over files,
# but any variable NOT set in the project would otherwise fall through to the
# file value. Self-hosted/docker builds do not run this script and are not
# affected.
if [ -f .env.production ] || [ -f .env ] || [ -f .env.local ]; then
  echo "[vercel-build] removing repo .env files (platform env vars only)"
  rm -f .env.production .env .env.local
fi

echo "[vercel-build] prisma provider -> postgresql"
node scripts/prisma-provider.mjs postgresql

echo "[vercel-build] prisma generate"
./node_modules/.bin/prisma generate

echo "[vercel-build] prisma migrate deploy"
# Migration URL precedence: DIRECT_URL > DATABASE_URL_UNPOOLED (auto-set by
# the Vercel-Managed Neon integration) > DATABASE_URL.
MIGRATE_URL="${DIRECT_URL:-${DATABASE_URL_UNPOOLED:-}}"
if [ -n "$MIGRATE_URL" ]; then
  echo "[vercel-build] using ${DIRECT_URL:+DIRECT_URL}${DATABASE_URL_UNPOOLED:+DATABASE_URL_UNPOOLED} (direct connection) for migrations"
  DATABASE_URL="$MIGRATE_URL" ./node_modules/.bin/prisma migrate deploy
else
  echo "[vercel-build] DIRECT_URL / DATABASE_URL_UNPOOLED not set — using DATABASE_URL for migrations"
  echo "               (fine for non-pooled databases; for pooled Neon set DIRECT_URL)"
  ./node_modules/.bin/prisma migrate deploy
fi

echo "[vercel-build] next build"
./node_modules/.bin/next build