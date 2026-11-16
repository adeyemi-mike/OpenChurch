# Security Policy

## Supported versions

OpenChurch is pre-1.0. Security fixes are applied to the `main` branch; releases are tagged from it. If you operate a fork, keep it current with `main`.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email the maintainers via the repository's security contact (see the GitHub *Security* tab, or the contact listed in the README of the deployment you use). Include:

- A description of the issue and its impact
- Steps or a proof-of-concept to reproduce it
- Affected routes/files if known

We aim to acknowledge reports within 72 hours and will keep you informed of remediation progress. Responsible disclosure is appreciated — we will credit reporters in release notes unless you prefer otherwise.

## Security model (what is implemented today)

This section documents what is **actually in the code**, not aspirations. See docs/FEATURES.md for the planned/completed matrix.

### Implemented

- **Authentication**: bcrypt password hashing (cost 11); session tokens are 256-bit random values stored only as SHA-256 hashes; httpOnly + SameSite=Lax cookies; server-side session expiry (30 days) with automatic pruning of expired sessions and stale reset tokens (login-time + cron housekeeping).
- **Password recovery**: 256-bit single-use reset tokens, stored only as SHA-256 hashes, expiring after 60 minutes; atomic single-use claim (concurrent reuse impossible); every session is revoked on reset. Emails are dispatched after the HTTP response (`next/server` `after`), so response timing can never reveal whether an account exists; responses are always generic. When SMTP is not configured, the UI says so honestly and recovery falls back to the platform administrator.
- **Password change**: authenticated change requires the current password; all other sessions are revoked (`/api/auth/change-password`, profile page).
- **Authorisation**: every dashboard API route and server page enforces role permissions server-side (`requireChurch` / `requireChurchContext`); UI affordances are cosmetic only. Deleting published content requires editor-level permission (`content:manage`).
- **Tenant isolation**: every tenant query is scoped by `churchId` derived from the authenticated membership — never from client input. Cross-church access returns a uniform 404 (no tenant existence leak). Proven at the HTTP level by `tests/http-isolation.test.ts` (real route handlers, real sessions, two tenants) and at the service level by `tests/tenant-isolation.test.ts` / `tests/domains-lifecycle.test.ts`.
- **CSRF**: layered verification on every state-changing request — (1) `Origin` vs request host, (2) `TRUSTED_ORIGINS` allowlist, (3) double-submit cookie — plus SameSite=Lax session cookies.
- **Rate limiting** (fixed windows, in-memory): login 10/15 min per IP **and per account** (with a dummy bcrypt compare so throttling reveals nothing); registration 5/h; password-reset request 5/h (generic response); reset submission 10/h; public form submissions 5/10 min; church creation 5/h per IP with a per-account ownership cap (`CHURCH_LIMIT_PER_USER`, default 10).
- **Host-header hardening**: password-reset links are only generated for origins this deployment owns (configured site URL, platform hosts, or a tenant's ACTIVE custom domain) — attacker-controlled `Host`/`X-Forwarded-Host` values suppress the email instead of poisoning the link. The tenant-resolving proxy likewise trusts `X-Forwarded-Host` only when the direct host is an internal address.
- **Custom domains**: ownership requires a DNS TXT challenge (`_openchurch-verify.<domain>`, hashed 72-hour tokens); hostnames are globally unique and can never belong to two tenants; a domain serves traffic only in status `ACTIVE` (ownership + provider assignment + DNS + SSL all confirmed); provider API failures never produce fake success; the maintenance cron endpoint requires `CRON_SECRET` and is disabled in production without it.
- **Spam protection**: honeypot field on public forms; filled honeypots receive a normal-looking success response and are silently discarded.
- **Uploads**: MIME whitelist, per-kind size limits, unguessable stored names, path-traversal-safe storage keys, SVG sanitisation (script/event-handler rejection) plus a restrictive CSP and `nosniff` on served files; private assets require authenticated membership of the owning church and are served `Cache-Control: private`.
- **Sensitive submissions**: prayer and counselling requests are flagged sensitive, excluded from editors, never rendered publicly; no IP addresses or user agents are stored with submissions and message contents are never logged.
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, HSTS and `X-Powered-By` removal are applied to every response.
- **Audit trail**: administrative actions are recorded (actor, action, entity, minimal metadata), including exports, deletions and domain lifecycle transitions.
- **Data export / deletion**: owner-initiated church JSON export; platform-admin account export/deletion (refused while the account owns a church); platform-admin church deletion with typed confirmation and best-effort provider cleanup.

### Known limitations (tracked, documented honestly)

- The **in-memory rate limiter** and its per-IP client identification suit single-instance deployments behind a trusted proxy (Vercel, nginx) only; horizontal scaling needs a shared store (the interface is swappable), and direct exposure would let clients spoof `X-Forwarded-For`.
- **Email verification** is not implemented — `User.emailVerified` is reserved but unused; registration signs the user in immediately.
- **Member invitations** enroll an existing account by email without a consent token (owner-only action, audited); a full invite-accept flow is future work.
- **No MFA/2FA** and no session-management UI (sessions are revoked wholesale on password reset/change).
- Payment processing is **link-based only** (external Paystack/Stripe payment pages); no card data ever touches OpenChurch, and no payment APIs are integrated yet.
- Analytics are **not** bundled; the dashboard shows a setup prompt rather than fabricated numbers.
- A full **CSP** is not yet set: Next.js App Router needs a nonce/strict-dynamic strategy through the proxy to avoid breaking hydration; media files carry their own restrictive CSP today.
- When deploying on PostgreSQL/Supabase, enable **Row Level Security** as defence-in-depth per docs/DATABASE.md; the application layer enforces isolation regardless.

## Hardening checklist for operators

1. Set `NEXT_PUBLIC_SITE_URL` to the real public origin (canonical URLs and trusted reset links depend on it) and rotate credentials if you suspect compromise (sessions can be invalidated by clearing the `sessions` table).
2. Set `CRON_SECRET` in production (the maintenance endpoint is disabled without it).
3. Serve exclusively over HTTPS; cookies switch to `Secure` automatically when `NODE_ENV=production`, and HSTS is sent on every response.
4. Restrict database and storage volumes to the application user.
5. Keep dependencies current: `bun audit` / `npm audit`.
6. Review the audit log (`/console/<church-slug>/activity`) regularly.
