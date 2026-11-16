# Architecture

## Design principles

1. **Multi-tenant from the core.** Every tenant-owned row carries `churchId`; every data access path derives that id from the *authenticated membership*, never from client input.
2. **One renderer, two consumers.** The public website renderer is used verbatim by the live site and the builder preview — what the owner previews is exactly what visitors get.
3. **The server is the source of truth.** Zod-validated API routes with server-side permission checks; the UI hides buttons as a courtesy, never as the control.
4. **Registries over hardcoding.** Themes, section types, form types, roles and permissions are registry/table-driven so the community extends the product without touching the core.
5. **Honest software.** No fabricated analytics, no dead buttons, no pretending an external integration is done when it isn't.

## Layer map

```
┌──────────────────────────────────────────────────────────────────┐
│ src/app/                        Next.js App Router                │
│   (platform)         /  /login  /register  /onboarding           │
│   (console)        /console/[slug]/…  (guarded server pages) │
│   (public sites)     /church/[slug]/[[...path]]  + /preview      │
│   (api)              /api/auth/*  /api/dashboard/[slug]/*        │
│                      /api/media/[id]/file  /api/public/[slug]/*   │
│                      /api/onboarding/*  /api/admin               │
├──────────────────────────────────────────────────────────────────┤
│ src/lib/                        Domain core (server-only)         │
│   auth/       session.ts (bcrypt+hashed sessions) guards.ts      │
│   api/        handler.ts — route(), requireChurch, parseBody,    │
│               ApiError, CSRF origin check, centralised errors    │
│   permissions.ts  role hierarchy + permission matrix (pure)      │
│   tenancy/    resolver.ts — PATH vs HOST church resolution        │
│   storage/    StorageDriver interface + local filesystem driver  │
│   sections/   types.ts (Zod schemas) registry.ts (metadata)      │
│               data.ts (dynamic section data loader)              │
│   themes/     registry.ts (ThemeDef tokens) fonts.ts             │
│   validation/ onboarding.ts entities.ts (all mutation schemas)   │
│   audit.ts  rate-limit.ts  slug.ts  color.ts  format.ts  i18n/   │
├──────────────────────────────────────────────────────────────────┤
│ src/components/                                                   │
│   public/sections/  15 section renderers (server components)     │
│   site/             header, footer, site renderer shell          │
│   builder/          page builder, schema-driven section editor,   │
│                     media picker                                  │
│   dashboard/        manager pages (client) + sidebar + shared     │
│   onboarding/       wizard + colour/image inputs                  │
├──────────────────────────────────────────────────────────────────┤
│ prisma/          schema.prisma (22 models) · seed.ts             │
└──────────────────────────────────────────────────────────────────┘
```

## Request flows

### Church admin edits a page

```
Browser → PATCH /api/dashboard/[slug]/pages/[id]
        → route() wrapper: CSRF origin check, error boundary
        → requireChurch(slug, 'pages:draft')
            → getSessionUser() (cookie → hashed token → session row)
            → membership lookup (user + church slug) → role
            → can(role, permission)?
        → parseBody (Zod: pagePatchSchema; sections re-validated
          against sectionsListSchema)
        → Prisma update scoped by churchId
        → recordAudit(page.updated)
        → ok(response)
```

### Public visitor opens a church page

```
GET /church/grace-community/sermons
  → server component: load church (ACTIVE, published)
  → load page by slug + status PUBLISHED
  → loadSectionData(churchId): services/events/sermons/ministries/
    leaders/giving/contact/forms — one parallel batch
  → ChurchSite renderer: branding CSS variables + theme tokens +
    navigation + published section snapshot
  → generateMetadata: per-page SEO + Open Graph; JSON-LD (schema.org/Church)
```

### Draft preview (the builder's iframe)

```
GET /church/[slug]/preview?pageId=…
  → requires membership (EDITOR+ or AUTHOR)
  → same ChurchSite renderer, but renders draftSections
  → preview banner; robots noindex
```

## Multi-tenancy model

| Concern | Mechanism |
| --- | --- |
| Tenant identity | `churchId` FK on every tenant entity |
| Context resolution | membership lookup: `user × church slug` → role (uniform 404 on mismatch) |
| Data access | all queries scoped by `churchId` from server context |
| URL routing | PATH mode: `/church/<slug>/…` (default). HOST mode: `resolveChurchByHost()` maps subdomains/custom domains (needs reverse proxy, see DEPLOYMENT) |
| Storage isolation | files stored under `storage/uploads/<churchId>/…`; private assets require membership to fetch |
| Cross-tenant tests | `tests/tenant-isolation.test.ts` |

## Page & section system

Pages own two JSON snapshots — `draftSections` and `publishedSections` — so:

- editing never affects the live site until publish,
- publishing is an atomic snapshot promotion,
- rollback is trivial.

Section lifecycle: registry metadata (field definitions) → builder form → JSON config → Zod validation on save → renderer component (shared with preview). Adding a section type touches exactly three places (schema, renderer, registry entry).

## Theme engine

A theme is a token set (container width, section rhythm, heading weight, radius, card style, nav style, hero layout, button shape, footer style). Church branding (primary/secondary colour, typography, logo) is applied as CSS custom properties on the `.ocs-site` scope, with automatic WCAG-aware foreground selection (`lib/color.ts`). Themes cannot be "locked" — the UI exposes all overrides.

## Extension points

- **Themes**: `THEMES` array — one `ThemeDef`.
- **Sections**: schema in `sections/types.ts` union + renderer + `SECTION_REGISTRY` entry.
- **Storage**: implement `StorageDriver` (S3, Supabase Storage) in `lib/storage/`.
- **Locales**: dictionary in `lib/i18n/` + `LOCALES` registration.
- **Payment providers**: giving module is link-based today; provider adapters would slot behind `GivingSettings.provider` with server-side integrations only.
- **Rate limiting**: `rateLimit(key, max, window)` — swap the in-memory store for Redis behind the same signature.
