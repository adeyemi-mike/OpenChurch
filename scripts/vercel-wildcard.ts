/**
 * vercel-wildcard.ts — one-time operator tool for subdomain addressing.
 *
 * Gives every church on the deployment an automatic subdomain address
 * (<slug>.<PLATFORM_ROOT_DOMAIN>) on MANAGED Vercel hosting by attaching
 * the wildcard domain `*.<PLATFORM_ROOT_DOMAIN>` to the Vercel project.
 *
 * What this script does (via the official Vercel REST API, using the same
 * server-side credentials the dashboard integration uses):
 *   1. Reads VERCEL_TOKEN, VERCEL_PROJECT_ID (+ optional VERCEL_TEAM_ID)
 *      and PLATFORM_ROOT_DOMAIN from the environment / .env.
 *   2. Checks whether the wildcard domain is already attached (idempotent).
 *   3. Attaches it if missing.
 *
 * What it CANNOT do (external steps — see docs/DEPLOYMENT.md):
 *   - The DNS record: a wildcard record `*.<root>` (CNAME to
 *     cname.vercel-dns.com, or A to 76.76.21.21) must be created at the
 *     registrar / DNS provider that hosts the root domain. This script
 *     prints the required record honestly instead of pretending.
 *   - The env vars themselves must be set on the deployment.
 *
 * Usage:
 *   bun scripts/vercel-wildcard.ts            # attach *.root to the project
 *   bun scripts/vercel-wildcard.ts --check    # only report status
 */
import { readFileSync, existsSync } from 'node:fs'

function loadDotEnv() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
}

const VERCEL_API = 'https://api.vercel.com'

async function main() {
  loadDotEnv()
  const token = process.env.VERCEL_TOKEN?.trim()
  const projectId = process.env.VERCEL_PROJECT_ID?.trim()
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || undefined
  const root = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase()
  const checkOnly = process.argv.includes('--check')

  if (!token || !projectId) {
    console.error(
      'Missing VERCEL_TOKEN / VERCEL_PROJECT_ID. Set them (and PLATFORM_ROOT_DOMAIN) in the environment or .env — see docs/DEPLOYMENT.md.'
    )
    process.exit(1)
  }
  if (!root || !root.includes('.')) {
    console.error(
      'Missing or invalid PLATFORM_ROOT_DOMAIN (e.g. openchurch.example). Subdomain addressing needs the platform root domain.'
    )
    process.exit(1)
  }
  const wildcard = `*.${root}`

  const headers = { Authorization: `Bearer ${token}` }
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  const projectUrl = `${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}${qs}`

  // 1. Read the project's current domains — idempotency check.
  const projRes = await fetch(projectUrl, { headers })
  if (projRes.status !== 200) {
    console.error(`Could not read the Vercel project (HTTP ${projRes.status}). Check the token and project access.`)
    process.exit(1)
  }
  const project = (await projRes.json()) as { name?: string; targets?: Record<string, unknown> }
  console.log(`Vercel project: ${project.name ?? projectId}`)

  const listRes = await fetch(`${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}/domains${qs}`, {
    headers,
  })
  if (listRes.status !== 200) {
    console.error(`Could not list project domains (HTTP ${listRes.status}).`)
    process.exit(1)
  }
  const { domains = [] } = (await listRes.json()) as {
    domains?: { name: string; verified: boolean }[]
  }
  const existing = domains.find((d) => d.name === wildcard)

  if (existing) {
    console.log(`\n✓ ${wildcard} is already attached to the project (verified: ${existing.verified}).`)
    console.log('  Requests for <slug>.' + root + ' reach the app once the wildcard DNS record exists.')
  } else {
    if (checkOnly) {
      console.log(`\n✗ ${wildcard} is NOT attached to the project. Run without --check to attach it.`)
      process.exit(2)
    }
    console.log(`\nAttaching ${wildcard} to the project…`)
    const addRes = await fetch(`${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/domains${qs}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: wildcard }),
    })
    if (addRes.status === 200) {
      console.log(`✓ Attached ${wildcard}.`)
    } else {
      const body = (await addRes.json().catch(() => ({}))) as { error?: { message?: string } }
      console.error(`✗ Vercel could not attach the domain (HTTP ${addRes.status}): ${body.error?.message ?? 'unknown error'}`)
      process.exit(1)
    }
  }

  console.log(
    `
External steps still required (the script cannot do these for you):
  1. DNS: at the provider hosting ${root}, create a wildcard record:
       *.${root}  CNAME  cname.vercel-dns.com   (or A 76.76.21.21)
  2. Env: PLATFORM_ROOT_DOMAIN=${root} on the deployment (already read here).
  3. The resolver then serves <church-slug>.${root} for every church slug —
     reserved names (www, api, admin, …) are excluded.

Honest limitation: with a wildcard attached, VERCEL_PROJECT_ID domains still
need their own verification per Vercel policy for the wildcard itself if
Vercel reports it unverified — check the Vercel dashboard domain list.`
  )
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
