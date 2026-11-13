#!/usr/bin/env node
/**
 * Flip the Prisma datasource provider between "sqlite" and "postgresql".
 *
 * WHY THIS EXISTS
 * ---------------
 * Prisma (prisma-client-js) requires a static provider in schema.prisma —
 * it cannot be chosen per environment at runtime. OpenChurch legitimately
 * targets both:
 *
 *   - SQLite  : zero-setup local development, docker-compose, small
 *               single-instance self-hosts, and the z.ai sandbox container.
 *   - Postgres: managed/serverless platforms (Neon, Supabase, RDS) and
 *               larger self-hosts. Required on Vercel, where the ephemeral
 *               filesystem cannot persist a SQLite file.
 *
 * The committed default is SQLite (so a fresh clone runs with zero config).
 * Serverless build pipelines call this script before `prisma generate` /
 * `prisma migrate deploy` — see scripts/vercel-build.sh.
 *
 * Usage:
 *   node scripts/prisma-provider.mjs              # show current provider
 *   node scripts/prisma-provider.mjs sqlite
 *   node scripts/prisma-provider.mjs postgresql
 *   npm run use:postgres | npm run use:sqlite
 *
 * The edit is a single-token replace inside the `datasource db` block —
 * deterministic, idempotent, and safe to run from CI.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCHEMA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma')
const VALID = ['sqlite', 'postgresql']

function currentProvider() {
  const schema = readFileSync(SCHEMA, 'utf8')
  const block = schema.match(/datasource\s+db\s*\{[\s\S]*?\}/)
  if (!block) throw new Error('datasource db block not found in schema.prisma')
  const m = block[0].match(/provider\s*=\s*"([^"]+)"/)
  if (!m) throw new Error('provider line not found in datasource block')
  return m[1]
}

function setProvider(next) {
  if (!VALID.includes(next)) {
    console.error(`Invalid provider "${next}". Expected one of: ${VALID.join(', ')}`)
    process.exit(1)
  }
  const before = currentProvider()
  if (before === next) {
    console.log(`prisma provider already "${next}" — nothing to do`)
    return
  }
  const schema = readFileSync(SCHEMA, 'utf8')
  const updated = schema.replace(
    /(datasource\s+db\s*\{[\s\S]*?provider\s*=\s*")([^"]+)(")/,
    `$1${next}$3`
  )
  writeFileSync(SCHEMA, updated)
  if (currentProvider() !== next) {
    console.error('Failed to rewrite provider — aborting so pipelines fail loudly.')
    process.exit(1)
  }
  console.log(`prisma provider: ${before} -> ${next}`)
}

const arg = process.argv[2]
if (!arg) {
  console.log(currentProvider())
} else {
  setProvider(arg)
}
