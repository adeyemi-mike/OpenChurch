# Security Policy

## Supported versions

OpenChurch is pre-1.0. Security fixes are applied to the `main` branch; releases are tagged from it. If you operate a fork, keep it current with `main`.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email the maintainers via the repository's security contact (see the GitHub *Security* tab, or the email in the README of the deployment you use). Include:

- A description of the issue and its impact
- Steps or a proof-of-concept to reproduce it
- Affected routes/files if known

We aim to acknowledge reports within 72 hours and will keep you informed of remediation progress. Responsible disclosure is appreciated — we will credit reporters in release notes unless you prefer otherwise.

## Security model (what is implemented today)

This section documents what is **actually in the code**, not aspirations. See docs/FEATURES.md for the planned/completed matrix.

### Implemented

- **Authentication**: bcrypt password hashing (cost 11); session tokens are 256-bit random values stored only as SHA-256 hashes; httpOnly + SameSite=Lax cookies; server-side session expiry.
- **Authorisation**: every dashboard API route and server page enforces role permissions server-side (`requireChurch` / `requireChurchContext`); UI affordances are cosmetic only.
- **Tenant isolation**: every tenant query is scoped by `churchId` derived from the authenticated membership — never from client input. Cross-church access returns a uniform 404 (no tenant existence leak). Covered by automated tests (`tests/tenant-isolation.test.ts`).
- **CSRF**: state-changing verbs verify the `Origin` header against the request host when present (same-site cookie policy is the second layer).
- **Input validation**: all mutations validate payloads with Zod; page sections are validated against strict schemas before persistence.
- **Rate limiting**: per-IP sliding windows on public form submissions (5/10 min) and login attempts (10/15 min).
- **Spam protection**: honeypot field on public forms; filled honeypots are silently discarded.
- **Uploads**: MIME whitelist, per-kind size limits, unguessable stored names, path-traversal-safe storage keys, SVG sanitisation (script/event-handler rejection) plus a restrictive CSP and `nosniff` on served files; private assets require authenticated membership.
- **Sensitive submissions**: prayer and counselling requests are flagged sensitive, excluded from editors, never rendered publicly, and we do not store IP addresses or user agents with submissions, nor log message contents.
- **Audit trail**: administrative actions are recorded (actor, action, entity, minimal metadata).
- **Secrets**: no credentials in the repository; service-role keys are never exposed to the client.

### Known limitations (tracked, documented honestly)

- The **in-memory rate limiter** suits single-instance deployments only; horizontal scaling needs a shared store (interface is swappable).
- **Domain verification** for custom domains stores records but performs no DNS challenge yet — host-based routing requires reverse-proxy configuration (see docs/DEPLOYMENT.md).
- **Email delivery** (invitations, notifications) is not implemented — members are added by email of an existing account.
- Payment processing is **link-based only** (external Paystack/Stripe payment pages); no card data ever touches OpenChurch, and no payment APIs are integrated yet.
- Analytics are **not** bundled; the dashboard shows a setup prompt rather than fabricated numbers.
- When deploying on PostgreSQL/Supabase, enable **Row Level Security** as defence-in-depth per docs/DATABASE.md; the application layer enforces isolation regardless.

## Hardening checklist for operators

1. Set a strong `SESSION_SECRET`-backed deployment secret policy and rotate credentials if you suspect compromise (sessions can be invalidated by clearing the `sessions` table).
2. Serve exclusively over HTTPS and set `Secure` cookies (automatic when `NODE_ENV=production`).
3. Restrict database and storage volumes to the application user.
4. Keep dependencies current: `bun audit` / `npm audit`.
5. Review the audit log (`/dashboard/<church>/activity`) regularly.
