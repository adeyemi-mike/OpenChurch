# Feature matrix — implemented vs planned

The honest list. "Implemented" means it exists in this codebase, is wired to the database and has working UI. Anything not implemented is stated as such, with the design hook that exists for it.

## Implemented ✅

### Platform
- Multi-tenant architecture: per-church profiles, settings, pages, content, media, users, domains, forms, giving, audit
- Registration, login, logout (bcrypt + hashed-session cookies, httpOnly)
- 5-step onboarding wizard (info → identity → structure → design → publish), skippable & resumable, slug availability checking
- Path-based church URLs (`/church/<slug>`); host-based resolver provided (see Deployment)
- Platform Super Admin console: tenant list, counts, publish status, suspend/activate, audit trail, user password reset (revokes all sessions, audited)
- Role-based access control (Owner / Admin / Editor / Author) enforced server-side on every route
- Audit log of administrative actions
- Password recovery via platform-admin reset (`scripts/promote-admin.ts` grants admin rights; reset happens in `/admin`). Self-service email reset requires SMTP — not integrated, and the UI says so honestly
- Demo seed: two churches (NG + UK), five users, realistic labelled content

### Website building
- Section-based page builder: 15 section types, add/remove/reorder/enable/edit, draft save, page publish, per-page SEO settings
- True WYSIWYG preview — the preview route renders the exact production renderer with draft sections; desktop/tablet/mobile widths
- Three themes (Modern Minimal, Traditional Elegant, Contemporary Vibrant) + church branding: colours (with WCAG-aware contrast), 4 typography pairings, logo, hero image, announcement bar
- Navigation manager (header + footer menus, page quick-picks)
- Appearance manager, Website settings (publish toggle, SEO defaults, map embed)
- Page lifecycle: Draft → Published → Archived; homepage protection

### Content management
- Ministries, Leadership, Events (upcoming/past, registration links), Sermons (speakers, series, scripture, YouTube embeds), Media library (uploads, validation, alt text, folders, pagination, public/private visibility)
- Church profile: identity, location, contact, locale (timezone/currency/date format), service times, multiple locations/branches
- Search/filter across managers; empty, loading and error states throughout
- Author draft-submission flow (authors cannot publish — enforced server-side)

### Public website engine
- Dynamic renderer driven by church branding + theme + published sections
- Public pages: Home, About, Contact, Events, Sermons, Ministries, Giving + unlimited custom pages
- Contact form, prayer request, counselling request, testimony, visitor follow-up forms
- Spam protection (honeypot + per-IP rate limiting) and server-side validation
- Unpublished-site holding page; per-church 404s
- SEO: per-page titles/meta, Open Graph, canonical URLs, per-church XML sitemaps, robots.txt, JSON-LD (schema.org/Church)
- Accessibility: semantic landmarks, skip links, focus visibility, keyboard navigable menus/dialogs, labelled inputs, alt text fields, contrast-checked brand colours, 44px touch targets, reduced-motion support
- i18n foundations: translation dictionary architecture, per-church timezone/currency/date formats, international phone/address formats

### Giving
- Configurable giving categories (tithes, offerings, missions, building fund, custom…)
- Modes: external payment link (Paystack/Stripe payment pages or any URL), bank transfer details, custom instructions
- Giving page section with live categories; **no card data ever handled by the platform**

### Enquiries
- Enquiry inbox with status workflow (New / In progress / Resolved / Archived), type & search filters
- Prayer & counselling submissions flagged sensitive: owner-only access, never public, no IPs/user-agents stored, no message logging

### Quality
- Vitest suite: permissions matrix, tenant isolation (DB-level), validation schemas, rate limiter, colour contrast, slug/section utilities — 56 tests
- ESLint: zero errors/warnings; TypeScript strict: zero errors

## Planned / not yet implemented 🚧

| Feature | Status & existing hook |
| --- | --- |
| Automated DNS verification for custom domains | **Shipped**: TXT challenge (`_openchurch-verify.<domain>`), hashed tokens with expiry, Vercel hosting assignment via API (or honest manual mode), primary-domain canonicals, proxy host routing — see docs/DEPLOYMENT.md → "Custom domains" |
| Direct Paystack/Stripe API giving | Link-based giving works; provider field + secure server-side design documented (SECURITY.md) |
| Recurring events UI | `events.isRecurring` / `recurrenceRule` columns exist; no recurrence editor yet |
| Email delivery (invites, notifications) | Members are added by existing account email; SMTP env placeholder reserved |
| Visitor analytics integration | Dashboard shows an honest setup prompt; no fabricated numbers |
| Image optimisation pipeline (derivatives, WebP) | Uploads validated + served immutable-cached; `sharp` present; derivative generation not wired |
| Full i18n of the admin UI | Architecture ready (`lib/i18n`); English ships today |
| Webhooks / REST API for church data | Not started |
| Content export (one-click) | Data is portable via Prisma/SQL today; a UI export button is planned |
| Automated E2E browser suite in CI | Manual browser verification performed for this release; Playwright suite planned |
| Sermon audio podcast feed (RSS) | Audio URL fields exist; feed generation not started |

## Deliberately out of scope for v0

- Storing or processing card data (never)
- Denomination-specific content structures (the platform stays neutral)
- A general-purpose drag-and-drop design tool (the section builder is intentionally simple and reliable)
