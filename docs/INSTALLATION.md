# Installation (local development)

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Bun (recommended) | 1.1+ | `curl -fsSL https://bun.sh/install \| bash` |
| or Node.js + npm | 20+ | All commands work with `npm run …` too |
| SQLite | bundled | Nothing to install for development |

Optional for production: Docker, PostgreSQL 14+.

## Steps

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# → defaults work for local development; nothing to change

# 3. Create the database schema
bun run db:push

# 4. (Recommended) seed two demo churches with realistic content
bun run db:seed

# 5. Start the dev server
bun run dev
```

Open http://localhost:3000.

## Demo accounts

The seed creates two churches — *Grace Community Church* (Lagos, contemporary) and *Emmanuel Parish Church* (Manchester, traditional) — with pages, ministries, events, sermons and enquiries. All demo content is clearly labelled as such.

| Email | Role |
| --- | --- |
| `owner@grace.demo` | Owner, Grace Community Church |
| `editor@grace.demo` | Editor, Grace Community Church |
| `author@grace.demo` | Author, Grace Community Church |
| `owner@emmanuel.demo` | Owner, Emmanuel Parish Church |
| `admin@openchurch.dev` | Platform Super Administrator |

Password for all: `Demo1234!`

> These accounts exist for local development and demos only. For any public deployment, remove the seed data (`bun run db:push --force-reset` without seeding) and register real accounts.

## Password recovery

OpenChurch does not require email delivery. Self-service email recovery works as soon as `SMTP_URL` is configured (see `.env.example`); without SMTP the supported recovery path is **platform-administrator reset**:

1. Register your own account through the website.
2. Grant yourself platform-admin rights from the server:

   ```bash
   bun scripts/promote-admin.ts you@example.com
   ```

3. Sign in and open `/admin`. The **Reset a user's password** card lets you set a new password for any account — every signed-in session of that user is revoked at the same time, and the reset is written to the audit log.

Users who forget their password see an honest explanation on the sign-in page's *Forgot password?* link (no fake "email sent" confirmation), directing them to their platform administrator.

## Daily commands

```bash
bun run dev          # dev server with hot reload
bun run lint         # ESLint — the project enforces zero warnings
bun run typecheck    # TypeScript strict check
bun run test         # Vitest (unit + tenant isolation)
bun run db:push      # apply schema changes to the database
bun run db:seed      # reseed demo content (destroys existing data)
```

## Where things live

```
src/app/            Next.js App Router — pages + API routes
src/components/     UI: dashboard, builder, public site sections, platform
src/lib/            Core: auth, permissions, tenancy, storage, themes, sections
prisma/             Database schema + seed
storage/            Media library files (local driver)
docs/               Documentation
tests/              Vitest suites
```

## Troubleshooting

- **`P1003: Database does not exist`** — run `bun run db:push`.
- **Demo images missing** — the seed downloads demo photography; re-run `bun run db:seed` with network access, or replace the URLs in `prisma/seed.ts`.
- **Port 3000 busy** — `bun run dev -- -p 3001`.
- **Reset everything** — delete `db/custom.db` and `storage/uploads/`, then `bun run db:push && bun run db:seed`.
