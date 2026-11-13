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
#      Set DIRECT_URL to the direct connection string in the Vercel project;
#      when it is absent we fall back to DATABASE_URL.
#   4. next build — the standard Next.js production build (Vercel handles
#      the rest: static assets, serverless functions, edge config).
#
# Required Vercel project environment variables:
#   DATABASE_URL      pooled/runtime connection string (e.g. Neon "-pooler"
#                     host with ?pgbouncer=true&sslmode=require)
#   DIRECT_URL        direct connection string for migrations (Neon host
#                     WITHOUT the -pooler suffix)
#   NEXT_PUBLIC_APP_URL  canonical public origin (https://…)
#   DEMO_MODE         must be "false" or unset on a real instance
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[vercel-build] prisma provider -> postgresql"
node scripts/prisma-provider.mjs postgresql

echo "[vercel-build] prisma generate"
./node_modules/.bin/prisma generate

echo "[vercel-build] prisma migrate deploy"
if [ -n "${DIRECT_URL:-}" ]; then
  DATABASE_URL="$DIRECT_URL" ./node_modules/.bin/prisma migrate deploy
else
  echo "[vercel-build] DIRECT_URL not set — using DATABASE_URL for migrations"
  echo "               (fine for non-pooled databases; for Neon set DIRECT_URL)"
  ./node_modules/.bin/prisma migrate deploy
fi

echo "[vercel-build] next build"
./node_modules/.bin/next build
