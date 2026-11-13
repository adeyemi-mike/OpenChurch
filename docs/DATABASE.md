# Database

## Overview

OpenChurch ships with **Prisma ORM**. Local development uses SQLite (zero setup); the schema is written to run unchanged on PostgreSQL for production/managed hosting — switch with `npm run use:postgres` (one-line flip of the `provider` in `prisma/schema.prisma`), then point `DATABASE_URL` at your server.

## Entity map

```
users ──< church_memberships >── churches ──< everything tenant-owned
  │                                     ├── church_settings (1:1)
  │                                     ├── giving_settings (1:1)
  │                                     ├── church_domains
  │                                     ├── website_pages
  │                                     ├── navigation_menus (HEADER/FOOTER)
  │                                     ├── ministries
  │                                     ├── leaders
  │                                     ├── locations ──< services
  │                                     │            ──< events
  │                                     ├── sermon_series ──< sermons
  │                                     ├── media_assets
  │                                     ├── forms ──< form_submissions
  │                                     ├── giving_categories
  │                                     └── audit_logs
  ├──< sessions
  └──< audit_logs (actor)
```

## Conventions

- **UUID primary keys** (`@default(uuid())`).
- **Tenant ownership**: every tenant model has `churchId` with `onDelete: Cascade` and an index; membership/user deletion cascades cleanly (tenant deletion removes all tenant data — covered by tests).
- **Timestamps**: `createdAt` / `updatedAt` everywhere.
- **Statuses**: strings constrained by Zod at the API layer (`DRAFT | PUBLISHED | ARCHIVED` for content; `NEW | IN_PROGRESS | RESOLVED | ARCHIVED` for enquiries; `ACTIVE | SUSPENDED` for tenants).
- **JSON payloads** (page sections, navigation items, audit metadata) are TEXT columns containing JSON because Prisma lacks a `Json` type on SQLite. All (de)serialisation flows through `src/lib/serialization.ts` so a PostgreSQL migration can switch those columns to `Json` in one place.
- **Page snapshots**: `website_pages` stores `draftSections` and `publishedSections` separately — publish promotes the draft snapshot atomically; the public site only ever reads the published one.

## Key indexes

Every tenant table indexes `churchId` (+ often `status` or the natural sort). Unique constraints:

| Table | Constraint |
| --- | --- |
| `churches` | `slug` |
| `church_memberships` | (`churchId`, `userId`) |
| `website_pages` | (`churchId`, `slug`) |
| `ministries` | (`churchId`, `slug`) |
| `giving_categories` | (`churchId`, `slug`) |
| `forms` | (`churchId`, `type`) |
| `navigation_menus` | (`churchId`, `location`) |
| `church_domains` | `domain` |
| `user_accounts` | `email` |
| `sessions` | `tokenHash` (hashed session tokens only) |

## Migrations

```bash
bun run db:push        # development (SQLite): sync schema (fast, no migration files)
bun run db:migrate     # prisma migrate dev — create a migration file (PostgreSQL path)
bun run db:reset       # reset + reapply
```

The two providers have separate sync mechanisms:

- **SQLite** (default): `bun run db:push`. No migration files involved.
- **PostgreSQL** (`npm run use:postgres`): the committed migration history in
  `prisma/migrations` (PostgreSQL dialect, initial migration `init` ships with
  the repo). Apply with `prisma migrate deploy`; create new migrations locally
  with `bun run db:migrate` against a Postgres you control and commit them.

Serverless builds (Vercel — `scripts/vercel-build.sh`) run `prisma migrate
deploy` automatically on every deployment.

## PostgreSQL / Supabase guidance

1. Run `npm run use:postgres` and point `DATABASE_URL` at your instance (Neon and Supabase both provide a **pooled** connection string for serverless and a direct one for migrations — set `DIRECT_URL` to the direct string; `scripts/vercel-build.sh` uses it for `prisma migrate deploy`).
2. Schema creation uses the committed migrations: `prisma migrate deploy`.
3. **Defence in depth — enable Row Level Security.** Application-layer isolation is enforced in code and tested, but RLS adds a database safety net. Recommended policies (adaptive for Supabase, where `auth.uid()` is available via the Supabase JWT):

```sql
-- Example: tenant tables get a policy pair like this per table
ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;

-- Application role (service connection used by OpenChurch) bypasses RLS;
-- add policies for any direct client access (e.g. Supabase JS):
CREATE POLICY tenant_read ON website_pages
  FOR SELECT USING (
    church_id IN (
      SELECT church_id FROM church_memberships m
      JOIN user_accounts u ON u.id = m.user_id
      WHERE u.id = auth.uid()::text
    )
  );
```

> OpenChurch itself does **not** require client-side Supabase access; all traffic flows through the application's server routes, which enforce isolation. RLS is recommended so that even a misconfigured direct connection cannot cross tenants.

## Seeding

`bun run db:seed` wipes and reseeds two demo churches (users, pages, sections, ministries, leaders, services, events, sermons, giving, forms, enquiries, media). Demo images are downloaded at seed time; demo content is clearly labelled.
