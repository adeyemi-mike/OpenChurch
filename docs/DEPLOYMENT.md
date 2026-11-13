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

- [ ] `NEXT_PUBLIC_APP_URL` set to your HTTPS origin (no trailing slash)
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
   | `NEXT_PUBLIC_APP_URL` | your final Vercel/custom domain, `https://…` |
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
| `NEXT_PUBLIC_APP_URL` | recommended | Canonical URLs, sitemaps, Open Graph (`NEXT_PUBLIC_SITE_URL` takes precedence if set) |
| `DEPLOYMENT_MODE` | no (`PATH`) | `PATH` or `HOST` routing (below) |
| `PLATFORM_ROOT_DOMAIN` | HOST mode only | e.g. `openchurch.example` |
| `STORAGE_PATH` | no (`./storage/uploads`) | Media library location |

Optional integrations (none required; see `.env.example`): Paystack/Stripe keys for future direct integrations, SMTP for email, analytics.

## Church URL routing

### PATH mode (default — works everywhere)

Churches are served at `https://your-host/church/<slug>`. Zero DNS work. This is what the hosted demo uses.

### HOST mode (subdomains / custom domains)

For `grace.openchurch.example` or `www.gracecommunity.org`:

1. Set `DEPLOYMENT_MODE=HOST` and `PLATFORM_ROOT_DOMAIN=openchurch.example`.
2. Add a wildcard DNS record `*.openchurch.example` → your server.
3. Configure your reverse proxy to forward **all** hosts to the app (the Host header is preserved).
4. The resolver (`src/lib/tenancy/resolver.ts`) maps the Host header to a church:
   - custom domain → exact match in `church_domains` (with `isVerified`)
   - subdomain of your root domain → church slug

**Honest status:** host resolution and the `church_domains` table are implemented; **automated DNS ownership verification is not** — `isVerified` must be set by an operator today. Subdomain mode additionally expects the wildcard above. For a single-church installation you can alternatively point your domain at the app and treat the church as the only tenant.

## Managed-platform operations

- **Platform admin console** (`/admin`, `isPlatformAdmin` users): tenant list, member/page counts, publish status, suspend/activate with audit trail.
- **Tenant suspension** freezes a church's dashboard and public site (owners still see a suspension notice).
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
