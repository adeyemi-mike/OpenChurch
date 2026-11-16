# Deployment

OpenChurch supports two deployment models, both from the same codebase:

1. **Self-hosted (single church or small federation)** — your server, your data.
2. **Managed multi-church platform** — one installation serving many churches.

## Databases: SQLite vs PostgreSQL

The committed Prisma schema defaults to **SQLite** so a fresh clone runs with
zero setup. PostgreSQL is recommended for production and **required on
serverless hosts** (Vercel/Netlify — their filesystem is ephemeral, a SQLite
file cannot persist). Switch with one command — no other code change:

```bash
npm run use:postgres   # prisma/schema.prisma → provider = "postgresql"
npm run use:sqlite     # back to SQLite (prisma db push path)
```

Each provider has its own schema-sync mechanism:

| Provider | Sync | Used by |
| --- | --- | --- |
| SQLite | `prisma db push` | dev, docker-compose, single-instance self-hosts |
| PostgreSQL | `prisma migrate deploy` (migrations in `prisma/migrations`) | Vercel + Neon, managed/self-hosted Postgres |

## Option 1 — Docker (recommended for self-hosting)

```bash
cp .env.example .env        # edit for production (see variables below)
docker compose up -d --build
docker compose exec app bun run db:push        # first run only
docker compose exec app bun run db:seed        # optional demo content
```

`docker-compose.yml` provisions the app (Next.js standalone build) plus a PostgreSQL volume. The app listens on port 3000 — put your TLS-terminating proxy (Caddy/Nginx/Traefik) in front.

Production checklist:

- [ ] `NEXT_PUBLIC_SITE_URL` set to your HTTPS origin (no trailing slash; `NEXT_PUBLIC_APP_URL` is a legacy alias)
- [ ] `DATABASE_URL` points at PostgreSQL
- [ ] `npm run use:postgres` executed (provider flip) — or verify `prisma/schema.prisma` says `postgresql`
- [ ] Persistent volumes for the database **and** `./storage`
- [ ] Do **not** seed demo accounts on a public instance (`db:push` only)
- [ ] HTTPS everywhere — cookies are `Secure` automatically in production

## Option 2 — Any Node host

```bash
bun install
bun run build          # Next.js standalone output
NODE_ENV=production bun .next/standalone/server.js
```

Run behind a reverse proxy that forwards to port 3000. Provide the environment variables below. SQLite works for small single-instance deployments; PostgreSQL is recommended.

## Option 3 — Vercel + Neon (serverless)

`vercel.json` wires the build to `scripts/vercel-build.sh`, which automatically
flips the Prisma provider to PostgreSQL, generates the client, applies
migrations and runs the Next.js build — no manual schema edits.

1. Create a project at [neon.tech](https://neon.tech) (free tier is enough to
   start). Copy both connection strings:
   - **Pooled** (host contains `-pooler`) → this is your runtime `DATABASE_URL`
   - **Direct** (no `-pooler`) → this is your migration `DIRECT_URL`
2. Import the repository into Vercel. Set the environment variables:
   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon **pooled** URL + `&pgbouncer=true&connection_limit=10` |
   | `DIRECT_URL` | Neon **direct** URL |
   | `NEXT_PUBLIC_SITE_URL` | your final Vercel/custom domain, `https://…` |
   | `DEMO_MODE` | `false` (or leave unset — production default is off) |
3. Deploy. The first build creates the full schema via `prisma migrate deploy`
   (migrations are committed in `prisma/migrations`, PostgreSQL dialect).
4. Register the first church owner at `https://your-app.vercel.app/register`
   and complete onboarding. **No demo data is seeded on serverless** — the
   seed script refuses to run unless demonstration mode is explicitly on.

Notes and honest limits:

- **Media uploads**: Vercel's filesystem is ephemeral, so files uploaded to
  the media library (`STORAGE_PATH`) are lost on every redeploy. For real
  uploads on serverless you must store files in an object store (Vercel Blob,
  S3/R2) — the upload API currently writes to local disk. Giving links
  (Paystack/Stripe payment pages) are plain URLs and work fine.
- **Rate limiting** is in-memory per serverless instance — see
  "Managed-platform operations" below.
- `prisma migrate dev` (creating new migrations) must run locally against a
  Postgres you control, after `npm run use:postgres`; commit the generated
  migration and let Vercel's build deploy it.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Prisma connection string (SQLite file or PostgreSQL) |
| `DIRECT_URL` | serverless Postgres | Direct (non-pooled) URL used by `prisma migrate deploy` — see scripts/vercel-build.sh |
| `NEXT_PUBLIC_SITE_URL` | recommended | Canonical URLs, sitemaps, Open Graph, trusted password-reset links. Legacy alias: `NEXT_PUBLIC_APP_URL` |
| `CRON_SECRET` | **required in production** | Bearer secret for the scheduled maintenance endpoint (`GET /api/cron/domains`: provider-domain rechecks + auth-artifact pruning). Without it the endpoint is DISABLED (503) in production; Vercel Cron injects the header automatically |
| `PLATFORM_ROOT_DOMAIN` | HOST mode only | e.g. `openchurch.example` |
| `STORAGE_PATH` | no (`./storage/uploads`) | Media library location |
| `VERCEL_TOKEN` | managed hosting, automated domains | Enables automated Vercel domain assignment (with `VERCEL_PROJECT_ID`) |
| `VERCEL_PROJECT_ID` | managed hosting, automated domains | Vercel project the domains are attached to |
| `VERCEL_TEAM_ID` | no | Vercel team scope, when the project belongs to a team |
| `CUSTOM_DOMAIN_MODE` | no (auto-derived) | Operator override for hosts the platform cannot auto-detect: `auto` (requires the provider variables above), `manual` (self-hosted workflow), `off` (domains unavailable) — see "Custom domains" below |
| `DOMAIN_LIMIT_FREE` / `DOMAIN_LIMIT_PAID` / `DOMAIN_LIMIT_PREMIUM` | no (0 / 1 / 10) | Custom-domain limits per subscription plan — see "Domain plans & limits" |
| `CRON_SECRET` | **required in production** | See above — the cron endpoint refuses to run unauthenticated in production |

Optional integrations (none required; see `.env.example`): Paystack/Stripe keys for future direct integrations, SMTP for email, analytics.

## Custom domains (church-owned domains)

OpenChurch supports custom domains in **two deployment models**, and it is
honest about which one a given installation is running as. The platform
address (`/church/<slug>`) keeps working everywhere and is never replaced —
a custom domain only adds another way in.

| Deployment model | Who configures domains | Hosting assignment | Status truth |
| --- | --- | --- | --- |
| **Self-hosted installation** (Docker / Node host) | Administrators, via DNS + reverse proxy (see HOST mode below); owners verify in the dashboard | Manual — the owner points DNS at the server and confirms; dashboard labels it "owner-confirmed" | DNS TXT for ownership; no provider API confirms hosting |
| **Managed hosting with provider integration** (Vercel: `VERCEL_TOKEN` + `VERCEL_PROJECT_ID`) | Church owners, entirely from **Dashboard → Custom Domains** | Automated through the provider API | Provider-verified (`verified`/`misconfigured` come from the API) |
| **Serverless hosting without the integration** (hosted demonstration, or Vercel without the token pair) | — not available — | The platform cannot complete the required configuration, so the dashboard reports domains as **unavailable** instead of offering steps that cannot succeed | n/a |

The capability is derived automatically (`src/lib/domains/capability.ts`):
provider variables set → managed hosting with automation; `VERCEL=1` (any
serverless runtime) without them → unavailable; anything else → self-hosted
manual workflow. Operators of hosts the platform cannot auto-detect (Coolify,
Fly.io, Kubernetes, …) can set `CUSTOM_DOMAIN_MODE=manual` / `off` / `auto`
explicitly; `auto` is honoured only when the provider variables are actually
configured — an auto declaration without credentials never pretends that
automation exists.

### Operator setup — once per deployment

Managed hosting (Vercel):

1. Create a Vercel API token with scope over the project
   (Project → Settings → Domains shows what the integration will do).
2. Set **server-side** environment variables on the deployment:
   `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` (from the project settings page) and,
   when the project belongs to a team, `VERCEL_TEAM_ID`. These are never
   exposed to the browser — only the boolean "integration configured" is.
3. Set `CRON_SECRET` (e.g. `openssl rand -hex 24`) — required in production; without it the cron endpoint answers 503. Vercel Cron
   (see below) then authenticates automatically.
4. Nothing else: every church — existing and future — can now connect its
   own domains from its dashboard. The operator never configures churches
   individually.

While the variables are unset, the platform reports managed custom domains
as **unavailable** (dashboard notice + `DOMAINS_UNAVAILABLE` API errors +
an explicit "not configured" panel in `/admin`) — it never implies the
feature works.

Optional subdomain addressing (`<slug>.<your-root-domain>` for every
church): set `PLATFORM_ROOT_DOMAIN`, attach the wildcard domain to the
Vercel project with `bun scripts/vercel-wildcard.ts`, and create the
wildcard DNS record at your registrar (`*.<root>` CNAME `cname.vercel-dns.com`
or A `76.76.21.21`). The script prints these steps honestly and is
idempotent. Wildcard TLS on Vercel covers `*.your-root-domain` automatically
once DNS propagates.

Self-hosted installations: see "HOST mode" below — the provider abstraction
is designed so Vercel is NOT a permanent dependency (`src/lib/domains/provider.ts`
defines the adapter interface; a new provider implements three methods).

### What every church automatically receives

Registering a church provisions its tenant atomically (onboarding wizard) and
with it a working **platform address** `https://<your-host>/church/<slug>`
— no operator action, no DNS work, valid immediately. Slug collisions and
reserved names (`www`, `api`, `admin`, …) are rejected at creation, and one
church can never claim another church's slug or hostname (both are globally
unique). On deployments with the wildcard setup above, the subdomain address
`https://<slug>.<root>` resolves to the same church automatically.

### Dashboard workflow (owners and admins, Dashboard → Custom Domains)

1. **Add domain** — validated and normalised (no IPs, localhost, ports,
   hosting-platform suffixes, or the platform's own hosts). Apex, www and
   subdomains are all supported; adding `www.` suggests the apex companion
   (and vice versa) — each hostname is verified independently.
2. **Verify ownership** — a unique TXT record
   (`_openchurch-verify.<domain>` → `openchurch-verify=<token>`) checked by a
   server-side DNS lookup. Tokens are 256-bit random values stored only as
   SHA-256 hashes, expire after 72h, and can be regenerated. A domain is
   never verified by clicking a button.
3. **Connect hosting**:
   - **Managed hosting, automated**: the platform adds the domain to the
     provider project, shows the provider's required DNS records (from the
     provider's own `suggestedValues` response — never hardcoded), and
     tracks the lifecycle below.
   - **Self-hosted, manual**: the dashboard shows DNS instructions; the
     owner points the domain at the server, configures the reverse proxy
     (below), and confirms. Status is labelled "owner-confirmed".
4. **Check status** — re-runs the provider inspection and an HTTPS probe.
   This is the retry path: failed verifications and failed provider
   assignments can be retried safely at any step.
5. **Set primary** — canonical URLs, sitemap URLs and Open Graph links use
   the primary domain; the platform slug route keeps working, and requests
   on the church's other ACTIVE domains redirect (308) to the primary —
   so `gracecommunity.org` and `www.gracecommunity.org` never compete.

### Domain lifecycle statuses

| Status | Meaning | Serves traffic? |
| --- | --- | --- |
| `PENDING` | Added; awaiting TXT ownership verification | no |
| `VERIFICATION_FAILED` | Last ownership check failed (retry or regenerate the token) | no |
| `VERIFIED` | Ownership proven; awaiting hosting assignment | no |
| `PENDING_DNS` | Attached to the provider; DNS not confirmed yet | no |
| `PENDING_SSL` | Provider confirms DNS; SSL/HTTPS not live yet | no |
| `ACTIVE` | Ownership + assignment + DNS + HTTPS all confirmed | **yes** |
| `FAILED` | The provider lost/never completed the assignment — retry | no |
| `SUSPENDED` | Suspended by the platform operator (kill-switch in `/admin`) | no |
| *(removed)* | Row deleted; the audit log retains the full history | no |

`ACTIVE` is set only from provider confirmation plus a successful HTTPS
probe (any HTTP response proves the certificate is live). A provider that
reports the domain missing **downgrades an ACTIVE row to `FAILED`**
immediately — provider failures never leave misleading active records.

### Background rechecks

- **Dashboard**: loading the Custom Domains page re-checks up to two
  provider-assigned domains whose last check is older than 5 minutes.
- **Scheduled**: `vercel.json` registers a cron job on
  `GET /api/cron/domains` (hourly on Vercel Pro; **the Hobby plan only runs
  cron jobs once a day**, so interactive rechecks are the primary path
  there). The endpoint re-checks up to 25 stale domains per run, protected
  by `CRON_SECRET` (required in production — the endpoint is disabled without
  it). Self-hosted operators can call it from their
  own scheduler: `curl -H "Authorization: Bearer $CRON_SECRET"
  https://your-host/api/cron/domains`.
- **Cache safety**: host→tenant lookups are cached for 60s per instance
  INCLUDING negative results — a removed or downgraded domain stops
  resolving within a minute even on instances that missed the invalidation.

### Domain plans & limits

Custom-domain access is controlled per church by a subscription plan
(`free` | `paid` | `premium`, set by the platform operator in `/admin`).
OpenChurch ships **no billing system and no hardcoded pricing** — the
entitlement interface (`src/lib/domains/entitlements.ts`) is deliberately
narrow so a future billing integration only has to write `Church.plan`.

- Limits are operator-configured via `DOMAIN_LIMIT_FREE` (default **0** —
  platform address only), `DOMAIN_LIMIT_PAID` (default **1**) and
  `DOMAIN_LIMIT_PREMIUM` (default **10**).
- Enforcement is server-side (`PLAN_LIMIT` errors); the dashboard shows the
  church's plan and used/limit count.
- The `/admin` churches table has a plan selector per church; every change
  is audited.

### Security properties

A hostname can only belong to one church (DB unique constraint +
claim-race handling); expired pending claims are reclaimable, verified
domains never transfer; ownership verification cannot be bypassed (DNS TXT
checked server-side, token stored as a hash); unverified domains never
serve tenant content; provider credentials stay server-side; domain
operations are audited and rate-limited; DNS/hostname inputs are strictly
validated; removal detaches hosting and stops resolution; the resolver
ignores `X-Forwarded-Host` from untrusted sources (host-header injection
is impossible); and one church's host can never resolve for another.

**DNS records the church adds** (its own registrar):
- `_openchurch-verify.<domain>` TXT `openchurch-verify=<token>` (ownership)
- the hosting records the provider reports (e.g. Vercel CNAME/A), displayed
  by the dashboard with copy buttons.

## Church URL routing

### PATH mode (default — works everywhere)

Churches are served at `https://your-host/church/<slug>`. Zero DNS work. This is what the hosted demo uses.

### HOST mode (subdomains / custom domains)

For `grace.openchurch.example` or `www.gracecommunity.org`:

1. Set `PLATFORM_ROOT_DOMAIN=openchurch.example` (subdomain routing is enabled by this variable plus wildcard DNS — there is no separate routing-mode switch).
2. Add a wildcard DNS record `*.openchurch.example` → your server.
3. Configure your reverse proxy to forward **all** hosts to the app (the Host header is preserved), with a wildcard TLS certificate for your root domain.
4. The resolver (`src/lib/tenancy/resolver.ts`) maps the Host header to a church:
   - custom domain → exact match in `church_domains` (only `ACTIVE` domains resolve)
   - subdomain of your root domain → church slug (reserved names excluded)
   - requests on a church's ACTIVE non-primary domain → 308 redirect to the primary domain

**Honest status:** host resolution, TXT ownership verification and the full
`church_domains` lifecycle are implemented (see "Custom domains" above).
Subdomain mode additionally expects the wildcard DNS record above — on Vercel,
`bun scripts/vercel-wildcard.ts` attaches the wildcard to the project for you
(the DNS record itself is created at your registrar). For a single-church
installation you can alternatively point your domain at the app and treat the
church as the only tenant.

## Managed-platform operations

- **Platform admin console** (`/admin`, `isPlatformAdmin` users): tenant list, member/page counts, publish status, suspend/activate with audit trail.
- **Tenant suspension** freezes a church's dashboard and public site (owners still see a suspension notice).
- **Data-subject tools**: platform admins export or delete user accounts (deletion is refused while the account owns a church) and can delete an entire church with typed slug confirmation — provider-assigned domains are removed from the hosting provider first (failures are reported honestly), media files are deleted from storage, and every tenant row cascades. Church owners export their own data from Website Settings → Your data.
- **Backups**: back up the database **and** the storage volume together. Tenant deletion cascades all tenant data.
- **Scaling note**: the in-memory rate limiter is per-instance. For multiple app replicas, front public endpoints with a shared limiter (or swap in the Redis driver of your choosing — `lib/rate-limit.ts` has a stable interface).

## Updating

```bash
git pull
bun install
bun run db:push          # or: prisma migrate deploy with migration files
# rebuild/restart per Option 1 or 2
```

Review [SECURITY.md](../SECURITY.md) and `git log` for anything requiring action. Schema changes are additive whenever possible.

## Going to production with PostgreSQL

1. `npm run use:postgres` (flips `prisma/schema.prisma` to `postgresql`).
2. `DATABASE_URL` → your PostgreSQL connection string (both in `.env` locally
   and in your host's environment).
3. Schema sync uses the committed migrations: `prisma migrate deploy`
   (creates/updates the schema; `prisma migrate dev --name <change>` locally
   when you need a NEW migration). For SQLite self-hosts, `bun run db:push`
   remains the sync mechanism.
4. Enable Row Level Security as defence in depth — see [DATABASE.md](DATABASE.md#postgresql--supabase-guidance).
