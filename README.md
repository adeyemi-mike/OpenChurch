# OpenChurch

**Every Church Deserves a Digital Home.**

OpenChurch is a free, open-source platform that gives any church — in any country, denomination or language — a professional, accessible website it can build and manage **without a developer**.

Multi-tenancy is built into the core, not bolted on: one installation serves a single church or a growing network, with strict data isolation and role-based permissions enforced on the server.

```bash
git clone <repo> openchurch && cd openchurch
bun install
cp .env.example .env
bun run db:push && bun run db:seed
bun run dev
```

Demo accounts (password `Demo1234!`): `owner@grace.demo` · `editor@grace.demo` · `author@grace.demo` · `owner@emmanuel.demo` · `admin@openchurch.dev`

---

## Why OpenChurch?

Most churches face the same choice: an expensive agency website they cannot update, a cheap template that looks like everyone else's, or nothing at all. OpenChurch is the fourth option: a genuinely open-source platform (MIT) with a no-code page builder, a guided onboarding wizard and a design system built for churches.

- **Denomination-neutral.** No hardcoded assumptions about structure, terminology or worship style — churches configure their own.
- **International by default.** Currencies, time zones, date formats and address formats are per-church settings. No country is special-cased.
- **Your data is yours.** Self-host on a €4 VPS, export your content, leave whenever you want. Managed hosting is optional — never required.
- **Accessible & SEO-first.** Semantic HTML, keyboard navigation, WCAG-conscious contrast, editable meta, sitemaps and structured data.

## Feature highlights

| Area | What you get |
| --- | --- |
| **Onboarding** | 5-step wizard: church information → identity & branding → structure (leaders, ministries, services, locations) → theme → publish. Skippable and resumable. |
| **Page builder** | 15 section types (hero, service schedule, events, sermons, ministry cards, leadership, gallery, testimonials, FAQ, giving, contact…), reorder/toggle/edit without code, draft → publish workflow, true WYSIWYG preview (the preview renders the exact production renderer) on desktop, tablet and mobile. |
| **Themes** | 3 professional themes (Modern Minimal, Traditional Elegant, Contemporary Vibrant) — starting points only; every church keeps full control of colours, typography and imagery. Community themes are registry additions. |
| **Content** | Pages, ministries, leadership, events (upcoming/past), sermons (speakers, series, scripture, YouTube embeds), media library with alt text and folders, navigation menus. Draft / Published / Archived with author → editor review flow. |
| **People** | Owner / Administrator / Editor / Author roles, server-enforced permissions, audit log of administrative actions, per-church user membership. |
| **Engagement** | Contact, prayer, counselling, testimony and visitor follow-up forms with spam protection; prayer/counselling submissions are access-restricted and never published. Giving module with categories and external links (Paystack/Stripe payment pages or bank instructions) — **no card data ever touches the platform**. |
| **Platform ops** | Multi-tenant by design, path-based church URLs (`/church/your-name`), host-based routing ready (subdomains/custom domains — see docs/DEPLOYMENT.md), platform-admin console with tenant health. |

See [docs/FEATURES.md](docs/FEATURES.md) for the honest implemented-vs-planned matrix.

## Quick start (local development)

**Prerequisites:** Node 20+ / Bun 1.1+, SQLite (bundled — nothing to install).

```bash
bun install                 # or: npm install
cp .env.example .env        # defaults work out of the box for development
bun run db:push             # create the schema
bun run db:seed             # two demo churches with realistic content
bun run dev                 # http://localhost:3000
```

Other useful scripts:

```bash
bun run lint        # ESLint (zero warnings policy)
bun run typecheck   # tsc --noEmit (strict)
bun run test        # Vitest unit + tenant-isolation suite
bun run db:seed     # reseed demo data (destroys existing data)
```

> **Note on the database:** development runs on SQLite for zero-setup. The Prisma schema is written to migrate to PostgreSQL for production — one provider switch, documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

- [Installation](docs/INSTALLATION.md) — local setup, step by step
- [Architecture](docs/ARCHITECTURE.md) — multi-tenancy, modules, rendering pipeline
- [Database](docs/DATABASE.md) — entity relationships, migrations, RLS guidance for PostgreSQL/Supabase
- [Deployment](docs/DEPLOYMENT.md) — Docker, PostgreSQL, custom domains, environment variables
- [Features](docs/FEATURES.md) — what is implemented and what is planned
- [Security policy](SECURITY.md) — reporting, threat model, hardening checklist

## Contributing

Contributions are welcome — themes, section types, translations, integrations and tests. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for our community standards.

**Good first contributions:**
- A new theme (a single `ThemeDef` entry — see `src/lib/themes/registry.ts`)
- A new page section (schema + renderer + registry entry — see `src/lib/sections/`)
- A translation of the admin interface (`src/lib/i18n/`)
- A storage driver (S3 / Supabase Storage — implement `StorageDriver` in `src/lib/storage/`)

## License

[MIT](LICENSE) — use it, fork it, host it commercially, keep your data. Built for the global church, by the community, for free.
